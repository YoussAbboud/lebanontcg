import type {
  Auction,
  AuctionDetail,
  AuctionInput,
  Bid,
  Conversation,
  ConversationSummary,
  ImageDraft,
  Listing,
  ListingFilter,
  ListingInput,
  ListingPage,
  ListingStatus,
  ListingWithSeller,
  Message,
  PendingReview,
  OfferStatus,
  Profile,
  ReportInput,
  Review,
  SellerStats,
} from '../types';
import type {
  AuctionEvent,
  AuthState,
  ConversationEvent,
  MarketplaceClient,
  PlacedBid,
  SignUpResult,
  Unsubscribe,
} from './MarketplaceClient';
import { listingMatchesFilter, sortListings } from '../filter';
import { minNextBid } from '../auction';
import { canTransition, statusChangeSystemMessage } from '../status';
import {
  buildSeedAuctions,
  seedBidderProfiles,
  buildSeedConversations,
  buildSeedListings,
  buildStressListings,
  seedFavorites,
  seedProfiles,
  seedReviews,
} from '../../mock/seed';
import { avatarDataUrl, cardImageUrl } from '../../mock/cardImage';
import type { Condition, Finish, Game } from '../types';
import type { DefectAssessment, PregradeReport, PregradeReportInput } from '../pregrade/types';
import { MOCK_ASSESSMENTS, mockCaseFrom } from '../pregrade/mockAssessments';
import { pregradePillLabel } from '../pregrade/copy';
import { CURRENT_STANDARD } from '../pregrade/standards';
import { PHASH_MISMATCH_COPY } from '../pregrade/phash';
import { capturesMatchCover } from '../pregrade/phashGate';

const AUTH_KEY = 'lebanontcg.mock.currentUser';

// IDs must be unique across tabs (each tab runs its own MockClient over a
// shared BroadcastChannel world), so a per-tab counter would collide.
let idCounter = 0;
const tabId = Math.random().toString(36).slice(2, 8);
const nextId = (prefix: string) => `${prefix}-${tabId}-${++idCounter}`;

/** Small randomized delay so pending/delivered chat states are exercised. */
const realtimeDelay = () => 250 + Math.random() * 650;
const netDelay = () => 40 + Math.random() * 120;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Fully offline MarketplaceClient. All state is in-memory (seeded from
 * src/mock/seed.ts); realtime is simulated with randomized delivery delays.
 * The signed-in mock user is remembered in localStorage per browser tab
 * profile, so two tabs can hold two different users… localStorage is shared
 * between tabs, so we use sessionStorage — each tab keeps its own user,
 * which is exactly what two-tab chat testing needs. Data, however, lives in
 * a BroadcastChannel-synchronized store so both tabs see the same world.
 */
export class MockClient implements MarketplaceClient {
  readonly isMock = true;

  private profiles: Profile[] = structuredClone([...seedProfiles, ...seedBidderProfiles]);
  private listings: Listing[] = [
    ...buildSeedListings(),
    ...buildStressListings(Number(import.meta.env.VITE_MOCK_STRESS ?? 0) || 0),
  ];
  private conversations: Conversation[];
  private messages: Message[];
  private auctions: Auction[] = [];
  private bids: Bid[] = [];
  private noShows: Array<{
    auctionId: string;
    reporterId: string;
    reportedId: string;
    role: 'winner' | 'seller';
    createdAt: string;
  }> = [];
  private favorites = new Map<string, Set<string>>();
  private reviews: Review[];
  private blocks = new Map<string, Set<string>>();
  private reports: ReportInput[] = [];
  /** Pre-grade reports live per-tab in mock mode (captures = object URLs). */
  private pregradeReports: PregradeReport[] = [];

  /**
   * Mock credential store, keyed by lowercased email. `password: null`
   * models an account created by magic link that hasn't set one yet — the
   * same state the real pre-password users are in.
   */
  private credentials = new Map<string, { userId: string; password: string | null }>();

  private auth: AuthState = { user: null, loading: true, needsPassword: false };
  private authListeners = new Set<(s: AuthState) => void>();
  private conversationListeners = new Map<string, Set<(ev: ConversationEvent) => void>>();
  private inboxListeners = new Set<() => void>();
  private listingListeners = new Map<string, Set<(l: Listing) => void>>();
  private auctionListeners = new Map<string, Set<(ev: AuctionEvent) => void>>();
  /** auctionId -> tabId -> last heartbeat (ms). Transient, never snapshotted. */
  private presence = new Map<string, Map<string, number>>();
  private presenceListeners = new Map<string, Set<(count: number) => void>>();
  private presenceTimers = new Map<string, number>();

  /** Cross-tab sync so two tabs (two mock users) share one world. */
  private channel: BroadcastChannel | null = null;
  private snapshotApplied = false;

  constructor() {
    const seeded = buildSeedConversations();
    this.conversations = seeded.conversations;
    this.messages = seeded.messages;
    const auc = buildSeedAuctions();
    this.listings.push(...auc.listings);
    this.auctions = auc.auctions;
    this.reviews = seedReviews.map((r) => ({
      ...r,
      reviewer: this.profiles.find((p) => p.id === r.reviewerId)!,
    }));
    for (const f of seedFavorites) {
      if (!this.favorites.has(f.userId)) this.favorites.set(f.userId, new Set());
      this.favorites.get(f.userId)!.add(f.listingId);
    }
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('lebanontcg-mock');
      this.channel.onmessage = (ev) => this.applyRemote(ev.data);
      // Ask any already-open tab for its state so a reloaded tab rejoins the
      // same mock world instead of resetting to the seed.
      this.channel.postMessage({ type: 'hello' } satisfies RemotePatch);
    }
    // Restore per-tab session
    const savedId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTH_KEY) : null;
    const user = savedId ? (this.profiles.find((p) => p.id === savedId) ?? null) : null;
    setTimeout(() => this.setAuth({ user, loading: false, needsPassword: this.needsPasswordFor(user) }), 30);
  }

  // ---- cross-tab state sync ----------------------------------------------

  private broadcast(patch: RemotePatch) {
    this.channel?.postMessage(patch);
  }

  private applyRemote(patch: RemotePatch) {
    switch (patch.type) {
      case 'hello': {
        // A new tab joined — offer it our current world.
        this.channel?.postMessage({ type: 'snapshot', state: this.snapshotState() } satisfies RemotePatch);
        break;
      }
      case 'snapshot': {
        if (this.snapshotApplied) break;
        this.snapshotApplied = true;
        const s = patch.state;
        this.profiles = s.profiles;
        this.listings = s.listings;
        this.conversations = s.conversations;
        this.messages = s.messages;
        this.auctions = s.auctions ?? this.auctions;
        this.bids = s.bids ?? this.bids;
        this.noShows = s.noShows ?? this.noShows;
        this.reviews = s.reviews;
        this.reports = s.reports;
        this.favorites = new Map(s.favorites.map(([k, v]) => [k, new Set(v)]));
        this.blocks = new Map(s.blocks.map(([k, v]) => [k, new Set(v)]));
        this.credentials = new Map(s.credentials ?? []);
        // Re-resolve the signed-in user against the shared world.
        const savedId = sessionStorage.getItem(AUTH_KEY);
        const user = savedId ? (this.profiles.find((p) => p.id === savedId) ?? null) : null;
        this.setAuth({
          user: user ? structuredClone(user) : null,
          loading: false,
          needsPassword: this.needsPasswordFor(user ?? null),
        });
        this.emitInbox();
        break;
      }
      case 'message': {
        if (!this.messages.some((m) => m.id === patch.message.id)) {
          this.messages.push(patch.message);
          const conv = this.conversations.find((c) => c.id === patch.message.conversationId);
          if (conv) conv.lastMessageAt = patch.message.createdAt;
        }
        this.emitConversation(patch.message.conversationId, {
          type: 'message',
          conversationId: patch.message.conversationId,
          message: patch.message,
        });
        this.emitInbox();
        break;
      }
      case 'read': {
        for (const m of this.messages) {
          if (m.conversationId === patch.conversationId && patch.messageIds.includes(m.id)) {
            m.readAt = patch.at;
          }
        }
        this.emitConversation(patch.conversationId, {
          type: 'refresh',
          conversationId: patch.conversationId,
        });
        this.emitInbox();
        break;
      }
      case 'listing': {
        const i = this.listings.findIndex((l) => l.id === patch.listing.id);
        if (i >= 0) this.listings[i] = patch.listing;
        else this.listings.push(patch.listing);
        this.emitListing(patch.listing);
        for (const c of this.conversations.filter((c) => c.listingId === patch.listing.id)) {
          this.emitConversation(c.id, {
            type: 'listing_updated',
            conversationId: c.id,
            listing: this.publicListing(patch.listing),
          });
        }
        this.emitInbox();
        break;
      }
      case 'conversation': {
        if (!this.conversations.some((c) => c.id === patch.conversation.id)) {
          this.conversations.push(patch.conversation);
        }
        this.emitInbox();
        break;
      }
      case 'offer': {
        const msg = this.messages.find((m) => m.id === patch.messageId);
        if (msg && msg.kind === 'offer') msg.offerStatus = patch.status;
        this.emitConversation(patch.conversationId, {
          type: 'refresh',
          conversationId: patch.conversationId,
        });
        this.emitInbox();
        break;
      }
      case 'typing': {
        if (patch.userId !== this.auth.user?.id) {
          this.emitConversation(patch.conversationId, {
            type: 'typing',
            conversationId: patch.conversationId,
          });
        }
        break;
      }
      case 'favorite': {
        if (!this.favorites.has(patch.userId)) this.favorites.set(patch.userId, new Set());
        if (patch.on) this.favorites.get(patch.userId)!.add(patch.listingId);
        else this.favorites.get(patch.userId)!.delete(patch.listingId);
        break;
      }
      case 'block': {
        if (!this.blocks.has(patch.blockerId)) this.blocks.set(patch.blockerId, new Set());
        if (patch.on) this.blocks.get(patch.blockerId)!.add(patch.blockedId);
        else this.blocks.get(patch.blockerId)!.delete(patch.blockedId);
        break;
      }
      case 'review': {
        if (!this.reviews.some((r) => r.id === patch.review.id)) {
          this.reviews.push(patch.review);
        }
        break;
      }
      case 'report': {
        this.reports.push(patch.report);
        break;
      }
      case 'credential': {
        this.credentials.set(patch.email, { userId: patch.userId, password: patch.password });
        break;
      }
      case 'presence': {
        const room = this.presence.get(patch.auctionId) ?? new Map<string, number>();
        if (patch.leaving) room.delete(patch.tabId);
        else room.set(patch.tabId, patch.at);
        this.presence.set(patch.auctionId, room);
        this.emitPresence(patch.auctionId);
        break;
      }
      case 'auction': {
        const i = this.auctions.findIndex((a) => a.id === patch.auction.id);
        if (i >= 0) this.auctions[i] = patch.auction;
        else this.auctions.push(patch.auction);
        this.emitAuction(patch.auction.id, { type: 'updated', auction: structuredClone(patch.auction) });
        break;
      }
      case 'noshow': {
        if (
          !this.noShows.some(
            (n) => n.auctionId === patch.noShow.auctionId && n.reporterId === patch.noShow.reporterId,
          )
        ) {
          this.noShows.push(patch.noShow);
        }
        break;
      }
      case 'bid': {
        if (!this.bids.some((b) => b.id === patch.bid.id)) {
          this.bids.push(patch.bid);
        }
        const auction = this.auctions.find((a) => a.id === patch.bid.auctionId);
        if (auction) {
          this.emitAuction(patch.bid.auctionId, {
            type: 'bid',
            auction: structuredClone(auction),
            bid: structuredClone(patch.bid),
          });
        }
        break;
      }
      case 'profile': {
        const i = this.profiles.findIndex((p) => p.id === patch.profile.id);
        if (i >= 0) this.profiles[i] = patch.profile;
        // If it's the signed-in user in this tab, refresh auth state too.
        if (this.auth.user?.id === patch.profile.id) {
          this.setAuth({ ...this.auth, user: structuredClone(patch.profile), loading: false });
        }
        break;
      }
    }
  }

  private snapshotState(): SnapshotState {
    return structuredClone({
      profiles: this.profiles,
      listings: this.listings,
      conversations: this.conversations,
      messages: this.messages,
      auctions: this.auctions,
      bids: this.bids,
      noShows: this.noShows,
      reviews: this.reviews,
      reports: this.reports,
      favorites: [...this.favorites.entries()].map(([k, v]) => [k, [...v]] as [string, string[]]),
      blocks: [...this.blocks.entries()].map(([k, v]) => [k, [...v]] as [string, string[]]),
      credentials: [...this.credentials.entries()],
    });
  }

  // ---- emit helpers -------------------------------------------------------

  /** A signed-in mock user needs a password when their credential has none. */
  private needsPasswordFor(user: Profile | null): boolean {
    if (!user) return false;
    const cred = [...this.credentials.values()].find((c) => c.userId === user.id);
    return cred ? cred.password === null : false;
  }

  private setAuth(state: AuthState) {
    this.auth = state;
    for (const cb of this.authListeners) cb(state);
  }

  private emitConversation(conversationId: string, ev: ConversationEvent) {
    for (const cb of this.conversationListeners.get(conversationId) ?? []) cb(ev);
  }

  private emitAuction(auctionId: string, ev: AuctionEvent) {
    for (const cb of this.auctionListeners.get(auctionId) ?? []) cb(ev);
  }

  /** Distinct live tabs (heartbeats < 12s old) — plus, for the scripted
      demo auction, three phantom viewers so the mock feels inhabited. */
  private presenceCount(auctionId: string): number {
    const room = this.presence.get(auctionId);
    const cutoff = Date.now() - 12_000;
    let n = 0;
    if (room) {
      for (const [tab, at] of room) {
        if (at >= cutoff) n++;
        else room.delete(tab);
      }
    }
    const a = this.auctions.find((x) => x.id === auctionId);
    if (auctionId === 'a-1' && a?.status === 'live') n += 3;
    return n;
  }

  private emitPresence(auctionId: string) {
    const n = this.presenceCount(auctionId);
    for (const cb of this.presenceListeners.get(auctionId) ?? []) cb(n);
  }

  private emitInbox() {
    for (const cb of this.inboxListeners) cb();
  }

  /** Clone a listing with storage paths resolved to displayable URLs —
      every Listing that leaves the client (returns or events) goes through
      this so image URLs are always usable. */
  private publicListing(listing: Listing): Listing {
    const clone = structuredClone(listing);
    for (const img of clone.images) img.url = this.resolveImageUrl(img.storagePath);
    return clone;
  }

  private emitListing(listing: Listing) {
    const resolved = this.publicListing(listing);
    for (const cb of this.listingListeners.get(listing.id) ?? []) cb(structuredClone(resolved));
  }

  private me(): Profile {
    if (!this.auth.user) throw new Error('Not signed in');
    return this.auth.user;
  }

  // ---- Auth ---------------------------------------------------------------

  getAuthState(): AuthState {
    return this.auth;
  }

  onAuthChange(cb: (state: AuthState) => void): Unsubscribe {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }

  /** Credential lookup key. */
  private credKey(email: string): string {
    return email.trim().toLowerCase();
  }

  private signInAs(userId: string, needsPassword: boolean) {
    const user = this.profiles.find((p) => p.id === userId);
    if (!user) throw new Error('Account not found');
    sessionStorage.setItem(AUTH_KEY, userId);
    this.setAuth({ user: structuredClone(user), loading: false, needsPassword });
  }

  /** Creates a fresh mock account (profile + credential) for an email. */
  private createAccount(email: string, password: string | null): string {
    const profile: Profile = {
      id: nextId('u'),
      username: null,
      displayName: email.split('@')[0] ?? 'collector',
      avatarUrl: null,
      bio: '',
      createdAt: new Date().toISOString(),
      ratingAvg: null,
      ratingCount: 0,
    };
    this.profiles.push(profile);
    this.credentials.set(this.credKey(email), { userId: profile.id, password });
    this.broadcast({ type: 'profile', profile: structuredClone(profile) });
    this.broadcast({
      type: 'credential',
      email: this.credKey(email),
      userId: profile.id,
      password,
    });
    return profile.id;
  }

  async signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
    await sleep(netDelay());
    if (this.credentials.has(this.credKey(email))) {
      throw new Error('An account with that email already exists — sign in instead.');
    }
    const userId = this.createAccount(email, password);
    // Mock has no inbox, so the account is usable immediately; live mode
    // requires the emailed confirmation first.
    this.signInAs(userId, false);
    return { needsEmailConfirmation: false };
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    await sleep(netDelay());
    const cred = this.credentials.get(this.credKey(email));
    if (!cred || cred.password === null || cred.password !== password) {
      throw new Error('Invalid email or password.');
    }
    this.signInAs(cred.userId, false);
  }

  /** Mock magic link: signs in straight away (no inbox to check). */
  async signInWithEmail(email: string): Promise<void> {
    await sleep(netDelay());
    const key = this.credKey(email);
    const cred = this.credentials.get(key);
    if (cred) {
      this.signInAs(cred.userId, cred.password === null);
      return;
    }
    // Unknown email → a new magic-link account, which still needs a password.
    this.signInAs(this.createAccount(email, null), true);
  }

  async setPassword(password: string): Promise<void> {
    const me = this.me();
    await sleep(netDelay());
    let entry = [...this.credentials.entries()].find(([, c]) => c.userId === me.id);
    if (!entry) {
      const email = `${me.username ?? me.id}@mock.test`;
      this.credentials.set(email, { userId: me.id, password });
      entry = [email, { userId: me.id, password }];
    } else {
      entry[1].password = password;
    }
    this.broadcast({ type: 'credential', email: entry[0], userId: me.id, password });
    this.setAuth({ ...this.auth, needsPassword: false });
  }

  async sendPasswordReset(_email: string): Promise<void> {
    await sleep(netDelay());
    // No inbox in mock mode — the dev switcher is the escape hatch.
  }

  async signOut(): Promise<void> {
    sessionStorage.removeItem(AUTH_KEY);
    this.setAuth({ user: null, loading: false, needsPassword: false });
  }

  async listMockUsers(): Promise<Profile[]> {
    return structuredClone(this.profiles);
  }

  async signInAsMockUser(userId: string): Promise<void> {
    const user = this.profiles.find((p) => p.id === userId);
    if (!user) throw new Error('Unknown mock user');
    sessionStorage.setItem(AUTH_KEY, userId);
    // The switcher is an explicit dev bypass — no password gate.
    this.setAuth({ user: structuredClone(user), loading: false, needsPassword: false });
  }

  async claimUsername(username: string): Promise<Profile> {
    const me = this.me();
    if (me.username) throw new Error('Username is already set and cannot be changed.');
    if (this.profiles.some((p) => p.username?.toLowerCase() === username.toLowerCase())) {
      throw new Error('That username is taken.');
    }
    const profile = this.profiles.find((p) => p.id === me.id)!;
    profile.username = username;
    this.setAuth({ ...this.auth, user: structuredClone(profile), loading: false });
    this.broadcast({ type: 'profile', profile: structuredClone(profile) });
    return structuredClone(profile);
  }

  async updateProfile(patch: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
  }): Promise<Profile> {
    const me = this.me();
    const profile = this.profiles.find((p) => p.id === me.id)!;
    if (patch.displayName !== undefined) profile.displayName = patch.displayName;
    if (patch.bio !== undefined) profile.bio = patch.bio;
    if (patch.avatarUrl !== undefined) profile.avatarUrl = patch.avatarUrl;
    this.setAuth({ ...this.auth, user: structuredClone(profile), loading: false });
    this.broadcast({ type: 'profile', profile: structuredClone(profile) });
    return structuredClone(profile);
  }

  async uploadAvatar(image: Blob): Promise<string> {
    // Data URL so it survives cross-tab snapshots and reloads.
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the image'));
      reader.readAsDataURL(image);
    });
  }

  // ---- Profiles -----------------------------------------------------------

  async getProfileByUsername(username: string): Promise<Profile | null> {
    await sleep(netDelay());
    const p = this.profiles.find((p) => p.username?.toLowerCase() === username.toLowerCase());
    return p ? this.withRating(p) : null;
  }

  async getProfile(id: string): Promise<Profile | null> {
    const p = this.profiles.find((p) => p.id === id);
    return p ? this.withRating(p) : null;
  }

  private sellerStatsFor(p: Profile, rank: number): SellerStats {
    const theirs = this.listings.filter((l) => l.sellerId === p.id);
    const active = theirs.filter((l) => l.status === 'active');
    const gameCounts = new Map<string, number>();
    for (const l of active) gameCounts.set(l.game, (gameCounts.get(l.game) ?? 0) + 1);
    return {
      profile: this.withRating(p),
      rank,
      activeCount: active.length,
      soldCount: theirs.filter((l) => l.status === 'sold').length,
      games: [...gameCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([g]) => g) as SellerStats['games'],
    };
  }

  /** Rank: review count, then rating, then live inventory. */
  private rankedSellers(): SellerStats[] {
    return this.profiles
      .map((p) => this.sellerStatsFor(p, 0))
      .sort(
        (a, b) =>
          b.profile.ratingCount - a.profile.ratingCount ||
          (b.profile.ratingAvg ?? 0) - (a.profile.ratingAvg ?? 0) ||
          b.activeCount - a.activeCount,
      )
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  async listSellers(limit: number): Promise<SellerStats[]> {
    await sleep(netDelay());
    return this.rankedSellers().slice(0, limit);
  }

  async getSellerStats(userId: string): Promise<SellerStats | null> {
    return this.rankedSellers().find((s) => s.profile.id === userId) ?? null;
  }

  /** Recompute rating fields from the reviews table (mirrors the SQL view). */
  private withRating(p: Profile): Profile {
    const received = this.reviews.filter((r) => r.revieweeId === p.id);
    const clone = structuredClone(p);
    if (received.length) {
      clone.ratingCount = received.length;
      clone.ratingAvg = received.reduce((s, r) => s + r.rating, 0) / received.length;
    }
    return clone;
  }

  // ---- Listings (read) ----------------------------------------------------

  private likesOf(listingId: string): number {
    let n = 0;
    for (const set of this.favorites.values()) if (set.has(listingId)) n++;
    return n;
  }

  private publishedReportFor(listingId: string): PregradeReport | undefined {
    return this.pregradeReports.find((r) => r.published && r.listingId === listingId);
  }

  private hydrate(l: Listing): ListingWithSeller {
    const seller = this.withRating(this.profiles.find((p) => p.id === l.sellerId)!);
    const clone = structuredClone(l);
    for (const img of clone.images) img.url = this.resolveImageUrl(img.storagePath);
    const report = this.publishedReportFor(l.id);
    const auction =
      l.saleType === 'auction'
        ? (this.auctions.find((a) => a.listingId === l.id) ?? null)
        : undefined;
    return {
      ...clone,
      ...(auction !== undefined ? { auction: structuredClone(auction) } : {}),
      seller,
      sellerActiveListingCount: this.listings.filter(
        (x) => x.sellerId === l.sellerId && x.status === 'active',
      ).length,
      likes: this.likesOf(l.id),
      pregradePill: report
        ? pregradePillLabel({
            band: report.band,
            base: report.base,
            isCeiling: report.isCeiling,
            recommendation: report.recommendation,
          })
        : null,
    };
  }

  async searchListings(filter: ListingFilter, offset: number, limit: number): Promise<ListingPage> {
    await sleep(netDelay());
    this.lazyCloseAuctions();
    let candidates = this.listings.filter((l) => listingMatchesFilter(l, filter));
    if (filter.sellerHasReviews) {
      candidates = candidates.filter(
        (l) => this.withRating(this.profiles.find((p) => p.id === l.sellerId)!).ratingCount > 0,
      );
    }
    if (filter.hasPregrade) {
      candidates = candidates.filter((l) => this.publishedReportFor(l.id));
    }
    const endsAtOf = (l: Listing) =>
      this.auctions.find((a) => a.listingId === l.id)?.endsAt ?? '9999';
    const matched =
      filter.sort === 'most_watched'
        ? [...candidates].sort(
            (a, b) =>
              this.likesOf(b.id) - this.likesOf(a.id) ||
              b.createdAt.localeCompare(a.createdAt) ||
              b.id.localeCompare(a.id),
          )
        : filter.sort === 'ending_soon'
          ? [...candidates]
              .filter((l) => l.saleType === 'auction')
              .sort((a, b) => endsAtOf(a).localeCompare(endsAtOf(b)))
          : sortListings(candidates, filter.sort);
    const page = matched.slice(offset, offset + limit);
    return {
      items: page.map((l) => this.hydrate(l)),
      total: matched.length,
      hasMore: offset + limit < matched.length,
    };
  }

  async getListing(id: string): Promise<ListingWithSeller | null> {
    await sleep(netDelay());
    this.lazyCloseAuctions();
    const l = this.listings.find((l) => l.id === id);
    return l ? this.hydrate(l) : null;
  }

  async getListingsBySeller(sellerId: string, statuses: ListingStatus[]): Promise<Listing[]> {
    await sleep(netDelay());
    return sortListings(
      this.listings.filter((l) => l.sellerId === sellerId && statuses.includes(l.status)),
      'newest',
    ).map((l) => {
      const clone = structuredClone(l);
      for (const img of clone.images) img.url = this.resolveImageUrl(img.storagePath);
      return clone;
    });
  }

  subscribeToListing(id: string, cb: (listing: Listing) => void): Unsubscribe {
    if (!this.listingListeners.has(id)) this.listingListeners.set(id, new Set());
    this.listingListeners.get(id)!.add(cb);
    return () => this.listingListeners.get(id)?.delete(cb);
  }

  // ---- Listings (write) ---------------------------------------------------

  async createListing(input: ListingInput, images: ImageDraft[]): Promise<Listing> {
    const me = this.me();
    await sleep(netDelay());
    const id = nextId('l');
    const nowIso = new Date().toISOString();
    const listing: Listing = {
      id,
      sellerId: me.id,
      ...input,
      status: 'active',
      saleType: 'fixed',
      reservedForConversationId: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      images: images.map((img, i) => ({
        id: nextId('img'),
        listingId: id,
        // New uploads keep their object/data URL as the "storage path" in
        // mock mode; seeded listings use mock-card:// procedural paths.
        storagePath: img.url,
        url: img.url,
        sortOrder: i,
      })),
    };
    this.listings.unshift(listing);
    this.broadcast({ type: 'listing', listing: structuredClone(listing) });
    return structuredClone(listing);
  }

  async updateListing(id: string, input: ListingInput, images: ImageDraft[]): Promise<Listing> {
    const me = this.me();
    const listing = this.listings.find((l) => l.id === id);
    if (!listing) throw new Error('Listing not found');
    if (listing.sellerId !== me.id) throw new Error('Only the seller can edit a listing');
    const priorPrice = listing.price;
    Object.assign(listing, input);
    // An auction listing's price mirrors the current bid — edits can't move it.
    if (listing.saleType === 'auction') listing.price = priorPrice;
    listing.updatedAt = new Date().toISOString();
    listing.images = images.map((img, i) => ({
      id: img.kind === 'existing' ? img.id : nextId('img'),
      listingId: id,
      storagePath:
        img.kind === 'existing'
          ? (listing.images.find((x) => x.id === img.id)?.storagePath ?? img.url)
          : img.url,
      url: img.url,
      sortOrder: i,
    }));
    this.emitListing(listing);
    this.broadcast({ type: 'listing', listing: structuredClone(listing) });
    return structuredClone(listing);
  }

  async setListingStatus(
    id: string,
    status: ListingStatus,
    opts?: { reservedForConversationId?: string | null },
  ): Promise<Listing> {
    const me = this.me();
    const listing = this.listings.find((l) => l.id === id);
    if (!listing) throw new Error('Listing not found');
    if (listing.sellerId !== me.id) throw new Error('Only the seller can change listing status');
    if (!canTransition(listing.status, status)) {
      throw new Error(`Cannot change a ${listing.status} listing to ${status}.`);
    }
    listing.status = status;
    listing.reservedForConversationId =
      status === 'reserved' ? (opts?.reservedForConversationId ?? null) : null;
    listing.updatedAt = new Date().toISOString();

    // Insert a system message into every conversation about this listing,
    // and notify their participants live.
    for (const conv of this.conversations.filter((c) => c.listingId === id)) {
      const sys: Message = {
        id: nextId('m'),
        conversationId: conv.id,
        senderId: '',
        kind: 'system',
        body: statusChangeSystemMessage(status, listing.reservedForConversationId === conv.id),
        amount: null,
        offerStatus: null,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      this.messages.push(sys);
      conv.lastMessageAt = sys.createdAt;
      this.emitConversation(conv.id, { type: 'message', conversationId: conv.id, message: sys });
      this.emitConversation(conv.id, {
        type: 'listing_updated',
        conversationId: conv.id,
        listing: this.publicListing(listing),
      });
      this.broadcast({ type: 'message', message: structuredClone(sys) });
    }
    this.emitListing(listing);
    this.emitInbox();
    this.broadcast({ type: 'listing', listing: structuredClone(listing) });
    return structuredClone(listing);
  }

  // ---- Auctions -----------------------------------------------------------
  // The mock engine mirrors the Postgres rules (place_bid, 0013) exactly:
  // the client-side checks in the UI are niceties, these are the mock's
  // actual rules.

  private handleOf(p: Profile): string {
    return p.username ? `@${p.username}` : p.displayName;
  }

  private topBidOf(auctionId: string): Bid | null {
    let top: Bid | null = null;
    for (const b of this.bids) {
      if (b.auctionId !== auctionId) continue;
      if (!top || b.amount > top.amount) top = b;
    }
    return top;
  }

  /** Overdue live auctions close on read, so a stale one never renders
      as live (mirrors close_due_auctions + the lazy close on read). */
  private lazyCloseAuctions() {
    for (const a of this.auctions) {
      if (a.status === 'live' && new Date(a.endsAt).getTime() <= Date.now()) {
        this.closeAuction(a);
      }
    }
  }

  /** Resolve the winner against the reserve, open the winner<->seller
      conversation, post the handoff message, park the listing. */
  private closeAuction(a: Auction) {
    const listing = this.listings.find((l) => l.id === a.listingId);
    const top = this.topBidOf(a.id);
    const nowIso = new Date().toISOString();
    if (top && (a.reservePrice === null || top.amount >= a.reservePrice)) {
      a.status = 'closed';
      a.winnerId = top.bidderId;
      a.winningBid = top.amount;
      let conv = this.conversations.find(
        (c) => c.listingId === a.listingId && c.buyerId === top.bidderId,
      );
      if (!conv) {
        conv = {
          id: nextId('c'),
          listingId: a.listingId,
          buyerId: top.bidderId,
          sellerId: a.sellerId,
          createdAt: nowIso,
          lastMessageAt: nowIso,
        };
        this.conversations.push(conv);
        this.broadcast({ type: 'conversation', conversation: structuredClone(conv) });
      }
      const winner = this.profiles.find((p) => p.id === top.bidderId);
      const sys: Message = {
        id: nextId('m'),
        conversationId: conv.id,
        senderId: '',
        kind: 'system',
        body: `${winner ? this.handleOf(winner) : 'The winner'} won this auction at ${a.currency} ${top.amount.toFixed(2)}. Sort out payment and delivery between yourselves — LebanonTCG isn't part of the transaction.`,
        amount: null,
        offerStatus: null,
        createdAt: nowIso,
        readAt: null,
      };
      this.messages.push(sys);
      conv.lastMessageAt = sys.createdAt;
      this.emitConversation(conv.id, { type: 'message', conversationId: conv.id, message: sys });
      this.broadcast({ type: 'message', message: structuredClone(sys) });
      if (listing && listing.status === 'active') {
        listing.status = 'reserved';
        listing.reservedForConversationId = conv.id;
        listing.updatedAt = nowIso;
        this.emitListing(listing);
        this.broadcast({ type: 'listing', listing: structuredClone(listing) });
      }
    } else {
      // No bids, or reserve not met: nobody wins, the card stays with
      // the seller and the listing leaves browse. Relist makes a new one.
      a.status = 'closed';
      if (listing && listing.status === 'active') {
        listing.status = 'removed';
        listing.updatedAt = nowIso;
        this.emitListing(listing);
        this.broadcast({ type: 'listing', listing: structuredClone(listing) });
      }
    }
    this.emitInbox();
    this.broadcast({ type: 'auction', auction: structuredClone(a) });
    this.emitAuction(a.id, { type: 'updated', auction: structuredClone(a) });
  }

  async createAuctionListing(
    input: ListingInput,
    images: ImageDraft[],
    auction: AuctionInput,
  ): Promise<Listing> {
    const me = this.me();
    if (!(auction.startingPrice > 0)) throw new Error('Starting price must be above zero.');
    if (auction.reservePrice !== null && auction.reservePrice < auction.startingPrice) {
      throw new Error('The reserve cannot be below the starting price.');
    }
    if (![1, 6, 24, 72, 168].includes(auction.durationHours)) {
      throw new Error('Invalid auction duration.');
    }
    const listing = await this.createListing(
      { ...input, price: auction.startingPrice, quantity: 1 },
      images,
    );
    const stored = this.listings.find((l) => l.id === listing.id)!;
    stored.saleType = 'auction';
    const a: Auction = {
      id: nextId('a'),
      listingId: listing.id,
      sellerId: me.id,
      startingPrice: auction.startingPrice,
      reservePrice: auction.reservePrice,
      currency: stored.currency,
      endsAt: new Date(Date.now() + auction.durationHours * 3600_000).toISOString(),
      status: 'live',
      winnerId: null,
      winningBid: null,
      cancelReason: null,
      createdAt: new Date().toISOString(),
    };
    this.auctions.push(a);
    this.broadcast({ type: 'listing', listing: structuredClone(stored) });
    this.broadcast({ type: 'auction', auction: structuredClone(a) });
    return structuredClone(stored);
  }

  async getAuctionForListing(listingId: string): Promise<AuctionDetail | null> {
    await sleep(netDelay());
    this.lazyCloseAuctions();
    const auction = this.auctions.find((a) => a.listingId === listingId);
    if (!auction) return null;
    const bids = this.bids
      .filter((b) => b.auctionId === auction.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.amount - a.amount);
    const myNoShowReported = Boolean(
      this.auth.user &&
        this.noShows.some(
          (n) => n.auctionId === auction.id && n.reporterId === this.auth.user!.id,
        ),
    );
    return structuredClone({ auction, bids, myNoShowReported });
  }

  /** The rules, mirrored from place_bid — used by the signed-in user
      and by the scripted mock bidders alike. */
  private placeBidAs(bidder: Profile, auctionId: string, amount: number): PlacedBid {
    this.lazyCloseAuctions();
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    if (a.status !== 'live' || new Date(a.endsAt).getTime() <= Date.now()) {
      throw new Error('This auction has ended.');
    }
    if (a.sellerId === bidder.id) throw new Error('Sellers cannot bid on their own auction.');
    if (this.isBlockedBetween(bidder.id, a.sellerId)) {
      throw new Error('You cannot bid on this auction.');
    }
    if (this.isBidBanned(bidder.id)) {
      throw new Error('Bidding is blocked on this account after repeated no-shows.');
    }
    const top = this.topBidOf(a.id);
    const min = minNextBid(top ? top.amount : null, a.startingPrice);
    if (amount < min) {
      throw new Error(`Minimum bid is ${min.toFixed(2)}.`);
    }
    const extended = new Date(a.endsAt).getTime() - Date.now() < 60_000;
    if (extended) {
      a.endsAt = new Date(new Date(a.endsAt).getTime() + 60_000).toISOString();
    }
    const bid: Bid = {
      id: nextId('bid'),
      auctionId: a.id,
      bidderId: bidder.id,
      bidderName: this.handleOf(bidder),
      amount,
      extended,
      createdAt: new Date().toISOString(),
    };
    this.bids.push(bid);
    const listing = this.listings.find((l) => l.id === a.listingId);
    if (listing) {
      listing.price = amount;
      listing.updatedAt = bid.createdAt;
      this.emitListing(listing);
      this.broadcast({ type: 'listing', listing: structuredClone(listing) });
    }
    this.broadcast({ type: 'auction', auction: structuredClone(a) });
    this.broadcast({ type: 'bid', bid: structuredClone(bid) });
    this.emitAuction(a.id, {
      type: 'bid',
      auction: structuredClone(a),
      bid: structuredClone(bid),
    });
    return { amount, endsAt: a.endsAt, extended };
  }

  async placeBid(auctionId: string, amount: number): Promise<PlacedBid> {
    const me = this.me();
    await sleep(netDelay());
    return this.placeBidAs(me, auctionId, amount);
  }

  subscribeToAuction(auctionId: string, cb: (ev: AuctionEvent) => void): Unsubscribe {
    if (!this.auctionListeners.has(auctionId)) this.auctionListeners.set(auctionId, new Set());
    this.auctionListeners.get(auctionId)!.add(cb);
    return () => this.auctionListeners.get(auctionId)?.delete(cb);
  }

  // ---- the scripted demo auction ------------------------------------------
  // MOCK=1 runs a little drama on the seeded ending-soon auction: four
  // fake bidders on timers, one landing inside the final 30 seconds to
  // exercise anti-snipe, and a close that produces a winner + system
  // message. ?case=reserve_not_met and ?case=cancelled cover the other
  // endings; ?case=fast compresses the clock for tests.
  private scriptStarted = new Set<string>();

  private maybeStartAuctionScript(auctionId: string) {
    if (auctionId !== 'a-1' || this.scriptStarted.has(auctionId)) return;
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a || a.status !== 'live') return;
    // One tab runs the drama; others just watch it arrive over the
    // BroadcastChannel (localStorage is shared across same-origin tabs).
    const claimKey = `lebanontcg.mock.script.${auctionId}`;
    try {
      if (localStorage.getItem(claimKey)) {
        this.scriptStarted.add(auctionId);
        return;
      }
      localStorage.setItem(claimKey, String(Date.now()));
    } catch {
      // storage unavailable — run anyway
    }
    this.scriptStarted.add(auctionId);
    const caseHint =
      typeof location !== 'undefined'
        ? new URLSearchParams(location.search).get('case')
        : null;
    // Any named case compresses the clock so the whole story plays out
    // inside a couple of minutes.
    if (caseHint) {
      a.endsAt = new Date(Date.now() + 40_000).toISOString();
    }
    if (caseHint === 'reserve_not_met') {
      a.reservePrice = 100_000;
    }
    if (caseHint) {
      this.broadcast({ type: 'auction', auction: structuredClone(a) });
      this.emitAuction(a.id, { type: 'updated', auction: structuredClone(a) });
    }
    const bidders = ['u-karim', 'u-lina', 'u-nabil', 'u-rita']
      .map((id) => this.profiles.find((p) => p.id === id))
      .filter((p): p is Profile => Boolean(p) && p!.id !== a.sellerId);
    const scriptedBid = (i: number) => {
      try {
        const live = this.auctions.find((x) => x.id === a.id);
        if (!live || live.status !== 'live') return;
        const top = this.topBidOf(a.id);
        const amount = minNextBid(top ? top.amount : null, a.startingPrice);
        this.placeBidAs(bidders[i % bidders.length], a.id, amount);
      } catch {
        // Ended or already outbid — the script never fights the rules.
      }
    };
    const fast = caseHint !== null;
    window.setTimeout(() => scriptedBid(0), fast ? 2_000 : 5_000);
    window.setTimeout(() => scriptedBid(1), fast ? 6_000 : 25_000);
    window.setTimeout(() => scriptedBid(2), fast ? 11_000 : 55_000);
    if (caseHint === 'cancelled') {
      window.setTimeout(() => {
        const seller = this.profiles.find((p) => p.id === a.sellerId);
        if (seller) {
          try {
            this.cancelAuctionAs(seller, a.id, 'Demo: the card sold locally.');
          } catch {
            // already ended
          }
        }
      }, fast ? 15_000 : 70_000);
    } else if (caseHint === null || caseHint === 'fast') {
      // The sniper: one bid inside the final 30 seconds → anti-snipe.
      const snipeIn = new Date(a.endsAt).getTime() - Date.now() - 20_000;
      if (snipeIn > 0) window.setTimeout(() => scriptedBid(3), snipeIn);
    }
    // Sweep shortly after the (possibly extended) end so the close and
    // its system message land even with nobody navigating.
    const sweep = () => {
      const live = this.auctions.find((x) => x.id === a.id);
      if (!live) return;
      if (live.status !== 'live') return;
      if (new Date(live.endsAt).getTime() <= Date.now()) {
        this.lazyCloseAuctions();
        return;
      }
      window.setTimeout(sweep, 3_000);
    };
    window.setTimeout(sweep, Math.max(1_000, new Date(a.endsAt).getTime() - Date.now()));
  }

  subscribeToAuctionPresence(
    auctionId: string,
    cb: (count: number) => void,
    opts?: { join?: boolean },
  ): Unsubscribe {
    if (!this.presenceListeners.has(auctionId)) {
      this.presenceListeners.set(auctionId, new Set());
    }
    this.presenceListeners.get(auctionId)!.add(cb);

    const beat = () => {
      const room = this.presence.get(auctionId) ?? new Map<string, number>();
      room.set(tabId, Date.now());
      this.presence.set(auctionId, room);
      this.broadcast({ type: 'presence', auctionId, tabId, at: Date.now() });
      this.emitPresence(auctionId);
    };
    let heartbeat: number | undefined;
    if (opts?.join) {
      // Being in the room is what starts the scripted demo auction —
      // passive observers (home cards) must never claim it, or they'd
      // fix the clock before the room could apply its ?case=.
      this.maybeStartAuctionScript(auctionId);
      beat();
      heartbeat = window.setInterval(beat, 4_000);
    } else {
      cb(this.presenceCount(auctionId));
    }
    // Observers still need stale tabs pruned and demo drift refreshed.
    const pruneKey = `${auctionId}:${Math.random()}`;
    const prune = window.setInterval(() => this.emitPresence(auctionId), 5_000);
    this.presenceTimers.set(pruneKey, prune);

    return () => {
      this.presenceListeners.get(auctionId)?.delete(cb);
      window.clearInterval(prune);
      this.presenceTimers.delete(pruneKey);
      if (heartbeat !== undefined) {
        window.clearInterval(heartbeat);
        this.presence.get(auctionId)?.delete(tabId);
        this.broadcast({ type: 'presence', auctionId, tabId, at: Date.now(), leaving: true });
        this.emitPresence(auctionId);
      }
    };
  }

  async endAuctionEarly(auctionId: string): Promise<void> {
    const me = this.me();
    await sleep(netDelay());
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    if (a.sellerId !== me.id) throw new Error('Only the seller can end this auction.');
    if (a.status !== 'live') throw new Error('This auction is not live.');
    a.endsAt = new Date().toISOString();
    this.closeAuction(a);
  }

  async cancelAuction(auctionId: string, reason: string): Promise<void> {
    const me = this.me();
    await sleep(netDelay());
    this.cancelAuctionAs(me, auctionId, reason);
  }

  private cancelAuctionAs(actor: Profile, auctionId: string, reason: string): void {
    if (!reason || reason.trim().length < 3) throw new Error('A cancellation reason is required.');
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    if (a.sellerId !== actor.id) throw new Error('Only the seller can cancel this auction.');
    if (a.status !== 'live') throw new Error('This auction is not live.');
    a.status = 'cancelled';
    a.cancelReason = reason.trim();
    const nowIso = new Date().toISOString();
    const listing = this.listings.find((l) => l.id === a.listingId);
    if (listing && listing.status === 'active') {
      listing.status = 'removed';
      listing.updatedAt = nowIso;
      this.emitListing(listing);
      this.broadcast({ type: 'listing', listing: structuredClone(listing) });
    }
    // Every bidder hears about it, in chat, with the reason.
    const bidderIds = [...new Set(this.bids.filter((b) => b.auctionId === a.id).map((b) => b.bidderId))];
    for (const bidderId of bidderIds) {
      let conv = this.conversations.find(
        (c) => c.listingId === a.listingId && c.buyerId === bidderId,
      );
      if (!conv) {
        conv = {
          id: nextId('c'),
          listingId: a.listingId,
          buyerId: bidderId,
          sellerId: a.sellerId,
          createdAt: nowIso,
          lastMessageAt: nowIso,
        };
        this.conversations.push(conv);
        this.broadcast({ type: 'conversation', conversation: structuredClone(conv) });
      }
      const sys: Message = {
        id: nextId('m'),
        conversationId: conv.id,
        senderId: '',
        kind: 'system',
        body: `The seller cancelled this auction. Reason: ${a.cancelReason}`,
        amount: null,
        offerStatus: null,
        createdAt: nowIso,
        readAt: null,
      };
      this.messages.push(sys);
      conv.lastMessageAt = sys.createdAt;
      this.emitConversation(conv.id, { type: 'message', conversationId: conv.id, message: sys });
      this.broadcast({ type: 'message', message: structuredClone(sys) });
    }
    this.emitInbox();
    this.broadcast({ type: 'auction', auction: structuredClone(a) });
    this.emitAuction(a.id, { type: 'updated', auction: structuredClone(a) });
  }

  /** Mirrors is_bid_banned (0015): three winner-role no-shows in 90 days. */
  private isBidBanned(userId: string): boolean {
    const cutoff = Date.now() - 90 * 86400_000;
    return (
      this.noShows.filter(
        (n) =>
          n.reportedId === userId &&
          n.role === 'winner' &&
          new Date(n.createdAt).getTime() > cutoff,
      ).length >= 3
    );
  }

  async reportAuctionNoShow(auctionId: string): Promise<void> {
    const me = this.me();
    await sleep(netDelay());
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    if (a.status !== 'closed' || !a.winnerId) {
      throw new Error('No-shows can only be reported on a closed auction with a winner.');
    }
    let reportedId: string;
    let role: 'winner' | 'seller';
    if (me.id === a.sellerId) {
      reportedId = a.winnerId;
      role = 'winner';
    } else if (me.id === a.winnerId) {
      reportedId = a.sellerId;
      role = 'seller';
    } else {
      throw new Error('Only the seller or the winner can report a no-show.');
    }
    if (this.noShows.some((n) => n.auctionId === auctionId && n.reporterId === me.id)) {
      throw new Error('Already reported.');
    }
    const noShow = {
      auctionId,
      reporterId: me.id,
      reportedId,
      role,
      createdAt: new Date().toISOString(),
    };
    this.noShows.push(noShow);
    const report: ReportInput = {
      targetType: 'user',
      targetId: reportedId,
      reason: 'other',
      detail: `Auction no-show (${role}) on auction ${auctionId}`,
    };
    this.reports.push(report);
    this.broadcast({ type: 'noshow', noShow: structuredClone(noShow) });
    this.broadcast({ type: 'report', report: structuredClone(report) });
  }

  async getAuctionNoShowCount(userId: string): Promise<number> {
    await sleep(netDelay());
    const cutoff = Date.now() - 90 * 86400_000;
    return this.noShows.filter(
      (n) =>
        n.reportedId === userId &&
        n.role === 'winner' &&
        new Date(n.createdAt).getTime() > cutoff,
    ).length;
  }

  // ---- Favorites ----------------------------------------------------------

  private myFavorites(): Set<string> {
    const me = this.me();
    if (!this.favorites.has(me.id)) this.favorites.set(me.id, new Set());
    return this.favorites.get(me.id)!;
  }

  async getFavoriteIds(): Promise<Set<string>> {
    if (!this.auth.user) return new Set();
    return new Set(this.myFavorites());
  }

  async getFavoriteListings(): Promise<ListingWithSeller[]> {
    await sleep(netDelay());
    const ids = this.myFavorites();
    return this.listings
      .filter((l) => ids.has(l.id) && l.status !== 'removed')
      .map((l) => this.hydrate(l));
  }

  async setFavorite(listingId: string, favorited: boolean): Promise<void> {
    const me = this.me();
    const favs = this.myFavorites();
    if (favorited) favs.add(listingId);
    else favs.delete(listingId);
    this.broadcast({ type: 'favorite', userId: me.id, listingId, on: favorited });
  }

  // ---- Chat ---------------------------------------------------------------

  private isBlockedBetween(a: string, b: string): boolean {
    return this.blocks.get(a)?.has(b) === true || this.blocks.get(b)?.has(a) === true;
  }

  private summarize(conv: Conversation): ConversationSummary {
    const me = this.me();
    const listing = this.listings.find((l) => l.id === conv.listingId)!;
    const otherId = conv.buyerId === me.id ? conv.sellerId : conv.buyerId;
    const msgs = this.messages
      .filter((m) => m.conversationId === conv.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const listingClone = structuredClone(listing);
    for (const img of listingClone.images) img.url = this.resolveImageUrl(img.storagePath);
    return {
      ...structuredClone(conv),
      listing: listingClone,
      otherParty: this.withRating(this.profiles.find((p) => p.id === otherId)!),
      lastMessage: msgs.length ? structuredClone(msgs[msgs.length - 1]) : null,
      unreadCount: msgs.filter((m) => m.kind === 'user' && m.senderId !== me.id && !m.readAt).length,
    };
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const me = this.me();
    await sleep(netDelay());
    return this.conversations
      .filter((c) => c.buyerId === me.id || c.sellerId === me.id)
      .map((c) => this.summarize(c))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }

  async getConversation(id: string): Promise<ConversationSummary | null> {
    const me = this.me();
    await sleep(netDelay());
    const conv = this.conversations.find((c) => c.id === id);
    if (!conv || (conv.buyerId !== me.id && conv.sellerId !== me.id)) return null;
    return this.summarize(conv);
  }

  async openConversation(listingId: string): Promise<Conversation> {
    const me = this.me();
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Listing not found');
    if (listing.sellerId === me.id) throw new Error('You cannot message yourself');
    if (this.isBlockedBetween(me.id, listing.sellerId)) {
      throw new Error('You cannot message this seller.');
    }
    const existing = this.conversations.find(
      (c) => c.listingId === listingId && c.buyerId === me.id,
    );
    if (existing) return structuredClone(existing);
    const conv: Conversation = {
      id: nextId('c'),
      listingId,
      buyerId: me.id,
      sellerId: listing.sellerId,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    };
    this.conversations.push(conv);
    this.broadcast({ type: 'conversation', conversation: structuredClone(conv) });
    this.emitInbox();
    return structuredClone(conv);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const me = this.me();
    await sleep(netDelay());
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv || (conv.buyerId !== me.id && conv.sellerId !== me.id)) return [];
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => structuredClone(m));
  }

  async sendMessage(conversationId: string, body: string, clientId: string): Promise<Message> {
    const me = this.me();
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv || (conv.buyerId !== me.id && conv.sellerId !== me.id)) {
      throw new Error('Conversation not found');
    }
    const otherId = conv.buyerId === me.id ? conv.sellerId : conv.buyerId;
    if (this.isBlockedBetween(me.id, otherId)) {
      throw new Error('You cannot message this user.');
    }
    // Simulated network/realtime latency exercises the pending state.
    await sleep(realtimeDelay());
    const message: Message = {
      id: nextId('m'),
      conversationId,
      senderId: me.id,
      kind: 'user',
      body,
      amount: null,
      offerStatus: null,
      createdAt: new Date().toISOString(),
      readAt: null,
      clientId,
    };
    this.messages.push(message);
    conv.lastMessageAt = message.createdAt;
    this.emitConversation(conversationId, {
      type: 'message',
      conversationId,
      message: structuredClone(message),
    });
    this.emitInbox();
    this.broadcast({ type: 'message', message: structuredClone(message) });
    return structuredClone(message);
  }

  async sendOffer(
    conversationId: string,
    amount: number,
    note: string,
    clientId: string,
  ): Promise<Message> {
    const me = this.me();
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv || (conv.buyerId !== me.id && conv.sellerId !== me.id)) {
      throw new Error('Conversation not found');
    }
    if (!(amount > 0)) throw new Error('Offer amount must be above zero.');
    const otherId = conv.buyerId === me.id ? conv.sellerId : conv.buyerId;
    if (this.isBlockedBetween(me.id, otherId)) throw new Error('You cannot message this user.');
    await sleep(realtimeDelay());
    const message: Message = {
      id: nextId('m'),
      conversationId,
      senderId: me.id,
      kind: 'offer',
      body: note,
      amount,
      offerStatus: 'proposed',
      createdAt: new Date().toISOString(),
      readAt: null,
      clientId,
    };
    this.messages.push(message);
    conv.lastMessageAt = message.createdAt;
    this.emitConversation(conversationId, {
      type: 'message',
      conversationId,
      message: structuredClone(message),
    });
    this.emitInbox();
    this.broadcast({ type: 'message', message: structuredClone(message) });
    return structuredClone(message);
  }

  async respondToOffer(conversationId: string, messageId: string, accept: boolean): Promise<void> {
    const me = this.me();
    const msg = this.messages.find((m) => m.id === messageId && m.conversationId === conversationId);
    if (!msg || msg.kind !== 'offer') throw new Error('Offer not found');
    if (msg.senderId === me.id) throw new Error('You cannot respond to your own offer.');
    if (msg.offerStatus !== 'proposed') throw new Error('This offer was already settled.');
    const status: OfferStatus = accept ? 'accepted' : 'declined';
    msg.offerStatus = status;
    this.broadcast({ type: 'offer', conversationId, messageId, status });
    this.emitConversation(conversationId, { type: 'refresh', conversationId });
    if (accept) {
      const sys: Message = {
        id: nextId('m'),
        conversationId,
        senderId: '',
        kind: 'system',
        body: 'Offer accepted. Arrange payment and delivery between yourselves — LebanonTCG is not involved in the transaction.',
        amount: null,
        offerStatus: null,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      this.messages.push(sys);
      const conv = this.conversations.find((c) => c.id === conversationId);
      if (conv) conv.lastMessageAt = sys.createdAt;
      this.emitConversation(conversationId, { type: 'message', conversationId, message: structuredClone(sys) });
      this.broadcast({ type: 'message', message: structuredClone(sys) });
    }
    this.emitInbox();
  }

  sendTyping(conversationId: string): void {
    if (!this.auth.user) return;
    this.broadcast({ type: 'typing', conversationId, userId: this.auth.user.id });
  }

  async markConversationRead(conversationId: string): Promise<void> {
    const me = this.me();
    const at = new Date().toISOString();
    const ids: string[] = [];
    for (const m of this.messages) {
      if (
        m.conversationId === conversationId &&
        m.senderId !== me.id &&
        m.kind === 'user' &&
        !m.readAt
      ) {
        m.readAt = at;
        ids.push(m.id);
      }
    }
    if (ids.length) {
      this.emitConversation(conversationId, { type: 'refresh', conversationId });
      this.emitInbox();
      this.broadcast({ type: 'read', conversationId, messageIds: ids, at });
    }
  }

  subscribeToConversation(
    conversationId: string,
    cb: (ev: ConversationEvent) => void,
  ): Unsubscribe {
    if (!this.conversationListeners.has(conversationId)) {
      this.conversationListeners.set(conversationId, new Set());
    }
    this.conversationListeners.get(conversationId)!.add(cb);
    return () => this.conversationListeners.get(conversationId)?.delete(cb);
  }

  subscribeToInbox(cb: () => void): Unsubscribe {
    this.inboxListeners.add(cb);
    return () => this.inboxListeners.delete(cb);
  }

  async getTotalUnreadCount(): Promise<number> {
    if (!this.auth.user) return 0;
    const me = this.auth.user;
    const myConvIds = new Set(
      this.conversations
        .filter((c) => c.buyerId === me.id || c.sellerId === me.id)
        .map((c) => c.id),
    );
    return this.messages.filter(
      (m) => myConvIds.has(m.conversationId) && m.kind === 'user' && m.senderId !== me.id && !m.readAt,
    ).length;
  }

  // ---- Trust --------------------------------------------------------------

  async getReviewsForUser(userId: string): Promise<Review[]> {
    await sleep(netDelay());
    return this.reviews
      .filter((r) => r.revieweeId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => structuredClone(r));
  }

  async getConversationReviews(conversationId: string): Promise<Review[]> {
    await sleep(netDelay());
    return this.reviews
      .filter((r) => r.conversationId === conversationId)
      .map((r) => structuredClone(r));
  }

  async getReviewsWritten(): Promise<Review[]> {
    const me = this.me();
    await sleep(netDelay());
    return this.reviews
      .filter((r) => r.reviewerId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => structuredClone(r));
  }

  async getPendingReviews(): Promise<PendingReview[]> {
    const me = this.me();
    await sleep(netDelay());
    const out: PendingReview[] = [];
    for (const conv of this.conversations) {
      // Reviews run buyer → seller only (migration 0010).
      if (conv.buyerId !== me.id) continue;
      const listing = this.listings.find((l) => l.id === conv.listingId);
      if (!listing || listing.status !== 'sold') continue;
      const already = this.reviews.some(
        (r) => r.conversationId === conv.id && r.reviewerId === me.id,
      );
      if (already) continue;
      const otherId = conv.buyerId === me.id ? conv.sellerId : conv.buyerId;
      const listingClone = structuredClone(listing);
      for (const img of listingClone.images) img.url = this.resolveImageUrl(img.storagePath);
      out.push({
        conversationId: conv.id,
        listing: listingClone,
        otherParty: this.withRating(this.profiles.find((p) => p.id === otherId)!),
      });
    }
    return out;
  }

  async submitReview(conversationId: string, rating: number, body: string): Promise<Review> {
    const me = this.me();
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv || (conv.buyerId !== me.id && conv.sellerId !== me.id)) {
      throw new Error('Conversation not found');
    }
    if (conv.buyerId !== me.id) {
      throw new Error('Only the buyer reviews the seller on a completed deal.');
    }
    const listing = this.listings.find((l) => l.id === conv.listingId);
    if (!listing || listing.status !== 'sold') {
      throw new Error('Reviews open once the listing is marked sold.');
    }
    if (this.reviews.some((r) => r.conversationId === conversationId && r.reviewerId === me.id)) {
      throw new Error('You already reviewed this trade.');
    }
    if (rating < 1 || rating > 5) throw new Error('Rating must be 1–5.');
    const review: Review = {
      id: nextId('r'),
      conversationId,
      listingId: conv.listingId,
      reviewerId: me.id,
      revieweeId: conv.sellerId,
      rating,
      body,
      createdAt: new Date().toISOString(),
      reviewer: structuredClone(me),
    };
    this.reviews.push(review);
    this.broadcast({ type: 'review', review: structuredClone(review) });
    return structuredClone(review);
  }

  async submitReport(input: ReportInput): Promise<void> {
    this.me();
    await sleep(netDelay());
    this.reports.push(structuredClone(input));
    this.broadcast({ type: 'report', report: structuredClone(input) });
  }

  async getBlockedIds(): Promise<Set<string>> {
    if (!this.auth.user) return new Set();
    return new Set(this.blocks.get(this.auth.user.id) ?? []);
  }

  async setBlocked(userId: string, blocked: boolean): Promise<void> {
    const me = this.me();
    if (!this.blocks.has(me.id)) this.blocks.set(me.id, new Set());
    if (blocked) this.blocks.get(me.id)!.add(userId);
    else this.blocks.get(me.id)!.delete(userId);
    this.broadcast({ type: 'block', blockerId: me.id, blockedId: userId, on: blocked });
  }

  // ---- Pre-grade ----------------------------------------------------------

  async assessPregrade(input: {
    images: { slot: string; blob: Blob }[];
    hasRake: boolean;
    caseHint?: string;
  }): Promise<DefectAssessment> {
    this.me();
    await sleep(600 + netDelay());
    const assessment = MOCK_ASSESSMENTS[mockCaseFrom(input.caseHint)]();
    // Honesty guard, same as the live endpoint: no raking shots means
    // the surface stays unassessed no matter what the canned case says.
    if (!input.hasRake && !assessment.abstain) {
      assessment.surface = {
        score: null,
        confidence: 'not_assessed',
        borderline: false,
        findings: [],
      };
    }
    return assessment;
  }

  async savePregradeReport(input: PregradeReportInput): Promise<PregradeReport> {
    const me = this.me();
    await sleep(netDelay());
    const captures: PregradeReport['captures'] = {};
    for (const c of input.captures) captures[c.slot] = URL.createObjectURL(c.blob);
    const report: PregradeReport = {
      id: `pg-${Math.random().toString(36).slice(2, 10)}`,
      userId: me.id,
      listingId: null,
      published: false,
      standardsVersion: CURRENT_STANDARD.version,
      era: input.era,
      centeringMethod: input.centeringMethod,
      front: structuredClone(input.front),
      back: input.back ? structuredClone(input.back) : null,
      scoreCentering: input.scores.centering,
      scoreCorners: input.scores.corners,
      scoreEdges: input.scores.edges,
      scoreSurface: input.scores.surface,
      base: input.estimate.base,
      isCeiling: input.estimate.isCeiling,
      band: { ...input.estimate.band },
      confidence: input.estimate.confidence,
      recommendation: input.estimate.recommendation,
      assessment: structuredClone(input.assessment),
      notes: [...input.estimate.notes],
      modelId: 'mock',
      createdAt: new Date().toISOString(),
      outcome: null,
      captures,
      diagram: input.diagram ? structuredClone(input.diagram) : null,
    };
    this.pregradeReports.push(report);
    return structuredClone(report);
  }

  async listMyPregradeReports(): Promise<PregradeReport[]> {
    const me = this.me();
    await sleep(netDelay());
    return structuredClone(
      this.pregradeReports
        .filter((r) => r.userId === me.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async getPregradeReport(id: string): Promise<PregradeReport | null> {
    await sleep(netDelay());
    const r = this.pregradeReports.find((x) => x.id === id);
    if (!r) return null;
    if (!r.published && r.userId !== this.auth.user?.id) return null;
    return structuredClone(r);
  }

  async getPublishedPregradeReport(listingId: string): Promise<PregradeReport | null> {
    await sleep(netDelay());
    const r = this.publishedReportFor(listingId);
    return r ? structuredClone(r) : null;
  }

  async publishPregradeReport(reportId: string, listingId: string): Promise<PregradeReport> {
    const me = this.me();
    await sleep(netDelay());
    const r = this.pregradeReports.find((x) => x.id === reportId && x.userId === me.id);
    if (!r) throw new Error('Report not found.');
    const listing = this.listings.find((l) => l.id === listingId && l.sellerId === me.id);
    if (!listing) throw new Error('Attach the report to one of your own listings.');
    // The abuse gate: the report's front capture must look like the
    // listing's cover image.
    const front = r.captures.front;
    const cover = listing.images[0] ? this.resolveImageUrl(listing.images[0].storagePath) : null;
    if (front && cover && !(await capturesMatchCover(front, cover))) {
      throw new Error(PHASH_MISMATCH_COPY);
    }
    r.listingId = listingId;
    r.published = true;
    return structuredClone(r);
  }

  async unpublishPregradeReport(reportId: string): Promise<PregradeReport> {
    const me = this.me();
    await sleep(netDelay());
    const r = this.pregradeReports.find((x) => x.id === reportId && x.userId === me.id);
    if (!r) throw new Error('Report not found.');
    r.published = false;
    return structuredClone(r);
  }

  async recordPregradeOutcome(
    reportId: string,
    actualGrade: number,
    certNumber?: string,
  ): Promise<void> {
    const me = this.me();
    await sleep(netDelay());
    const r = this.pregradeReports.find((x) => x.id === reportId && x.userId === me.id);
    if (!r) throw new Error('Report not found.');
    r.outcome = {
      actualGrade,
      certNumber: certNumber ?? null,
      reportedAt: new Date().toISOString(),
    };
  }

  // ---- Storage ------------------------------------------------------------

  resolveImageUrl(storagePath: string): string {
    if (storagePath.startsWith('mock-card://')) {
      // mock-card://<game>/<seed>/<finish>/<condition>
      const [game, seed, finish, condition] = storagePath
        .slice('mock-card://'.length)
        .split('/');
      return cardImageUrl({
        game: game as Game,
        seed,
        finish: finish as Finish,
        condition: condition as Condition,
      });
    }
    if (storagePath.startsWith('mock-avatar://')) {
      return avatarDataUrl(storagePath.slice('mock-avatar://'.length));
    }
    return storagePath; // data:/blob: URLs pass through
  }
}

interface SnapshotState {
  profiles: Profile[];
  listings: Listing[];
  conversations: Conversation[];
  messages: Message[];
  auctions?: Auction[];
  bids?: Bid[];
  noShows?: Array<{
    auctionId: string;
    reporterId: string;
    reportedId: string;
    role: 'winner' | 'seller';
    createdAt: string;
  }>;
  reviews: Review[];
  reports: ReportInput[];
  favorites: Array<[string, string[]]>;
  blocks: Array<[string, string[]]>;
  credentials: Array<[string, { userId: string; password: string | null }]>;
}

type RemotePatch =
  | { type: 'hello' }
  | { type: 'snapshot'; state: SnapshotState }
  | { type: 'message'; message: Message }
  | { type: 'read'; conversationId: string; messageIds: string[]; at: string }
  | { type: 'listing'; listing: Listing }
  | { type: 'conversation'; conversation: Conversation }
  | { type: 'offer'; conversationId: string; messageId: string; status: OfferStatus }
  | { type: 'typing'; conversationId: string; userId: string }
  | { type: 'favorite'; userId: string; listingId: string; on: boolean }
  | { type: 'block'; blockerId: string; blockedId: string; on: boolean }
  | { type: 'review'; review: Review }
  | { type: 'report'; report: ReportInput }
  | { type: 'profile'; profile: Profile }
  | { type: 'credential'; email: string; userId: string; password: string | null }
  | { type: 'auction'; auction: Auction }
  | { type: 'bid'; bid: Bid }
  | { type: 'presence'; auctionId: string; tabId: string; at: number; leaving?: boolean }
  | {
      type: 'noshow';
      noShow: {
        auctionId: string;
        reporterId: string;
        reportedId: string;
        role: 'winner' | 'seller';
        createdAt: string;
      };
    };
