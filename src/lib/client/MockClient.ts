import type {
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
  Profile,
  ReportInput,
  Review,
} from '../types';
import type {
  AuthState,
  ConversationEvent,
  MarketplaceClient,
  Unsubscribe,
} from './MarketplaceClient';
import { listingMatchesFilter, sortListings } from '../filter';
import { canTransition, statusChangeSystemMessage } from '../status';
import {
  buildSeedConversations,
  buildSeedListings,
  seedFavorites,
  seedProfiles,
  seedReviews,
} from '../../mock/seed';
import { avatarDataUrl, cardImageUrl } from '../../mock/cardImage';
import type { Condition, Finish, Game } from '../types';

const AUTH_KEY = 'cardpost.mock.currentUser';

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

  private profiles: Profile[] = structuredClone(seedProfiles);
  private listings: Listing[] = buildSeedListings();
  private conversations: Conversation[];
  private messages: Message[];
  private favorites = new Map<string, Set<string>>();
  private reviews: Review[];
  private blocks = new Map<string, Set<string>>();
  private reports: ReportInput[] = [];

  private auth: AuthState = { user: null, loading: true };
  private authListeners = new Set<(s: AuthState) => void>();
  private conversationListeners = new Map<string, Set<(ev: ConversationEvent) => void>>();
  private inboxListeners = new Set<() => void>();
  private listingListeners = new Map<string, Set<(l: Listing) => void>>();

  /** Cross-tab sync so two tabs (two mock users) share one world. */
  private channel: BroadcastChannel | null = null;
  private snapshotApplied = false;

  constructor() {
    const seeded = buildSeedConversations();
    this.conversations = seeded.conversations;
    this.messages = seeded.messages;
    this.reviews = seedReviews.map((r) => ({
      ...r,
      reviewer: this.profiles.find((p) => p.id === r.reviewerId)!,
    }));
    for (const f of seedFavorites) {
      if (!this.favorites.has(f.userId)) this.favorites.set(f.userId, new Set());
      this.favorites.get(f.userId)!.add(f.listingId);
    }
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('cardpost-mock');
      this.channel.onmessage = (ev) => this.applyRemote(ev.data);
      // Ask any already-open tab for its state so a reloaded tab rejoins the
      // same mock world instead of resetting to the seed.
      this.channel.postMessage({ type: 'hello' } satisfies RemotePatch);
    }
    // Restore per-tab session
    const savedId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTH_KEY) : null;
    const user = savedId ? (this.profiles.find((p) => p.id === savedId) ?? null) : null;
    setTimeout(() => this.setAuth({ user, loading: false }), 30);
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
        this.reviews = s.reviews;
        this.reports = s.reports;
        this.favorites = new Map(s.favorites.map(([k, v]) => [k, new Set(v)]));
        this.blocks = new Map(s.blocks.map(([k, v]) => [k, new Set(v)]));
        // Re-resolve the signed-in user against the shared world.
        const savedId = sessionStorage.getItem(AUTH_KEY);
        const user = savedId ? (this.profiles.find((p) => p.id === savedId) ?? null) : null;
        this.setAuth({ user: user ? structuredClone(user) : null, loading: false });
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
          type: 'read',
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
      case 'profile': {
        const i = this.profiles.findIndex((p) => p.id === patch.profile.id);
        if (i >= 0) this.profiles[i] = patch.profile;
        // If it's the signed-in user in this tab, refresh auth state too.
        if (this.auth.user?.id === patch.profile.id) {
          this.setAuth({ user: structuredClone(patch.profile), loading: false });
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
      reviews: this.reviews,
      reports: this.reports,
      favorites: [...this.favorites.entries()].map(([k, v]) => [k, [...v]] as [string, string[]]),
      blocks: [...this.blocks.entries()].map(([k, v]) => [k, [...v]] as [string, string[]]),
    });
  }

  // ---- emit helpers -------------------------------------------------------

  private setAuth(state: AuthState) {
    this.auth = state;
    for (const cb of this.authListeners) cb(state);
  }

  private emitConversation(conversationId: string, ev: ConversationEvent) {
    for (const cb of this.conversationListeners.get(conversationId) ?? []) cb(ev);
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

  async signInWithEmail(_email: string): Promise<void> {
    throw new Error('Magic-link sign-in is unavailable in mock mode. Use the dev user switcher.');
  }

  async signOut(): Promise<void> {
    sessionStorage.removeItem(AUTH_KEY);
    this.setAuth({ user: null, loading: false });
  }

  async listMockUsers(): Promise<Profile[]> {
    return structuredClone(this.profiles);
  }

  async signInAsMockUser(userId: string): Promise<void> {
    const user = this.profiles.find((p) => p.id === userId);
    if (!user) throw new Error('Unknown mock user');
    sessionStorage.setItem(AUTH_KEY, userId);
    this.setAuth({ user: structuredClone(user), loading: false });
  }

  async claimUsername(username: string): Promise<Profile> {
    const me = this.me();
    if (me.username) throw new Error('Username is already set and cannot be changed.');
    if (this.profiles.some((p) => p.username?.toLowerCase() === username.toLowerCase())) {
      throw new Error('That username is taken.');
    }
    const profile = this.profiles.find((p) => p.id === me.id)!;
    profile.username = username;
    this.setAuth({ user: structuredClone(profile), loading: false });
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
    this.setAuth({ user: structuredClone(profile), loading: false });
    this.broadcast({ type: 'profile', profile: structuredClone(profile) });
    return structuredClone(profile);
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

  private hydrate(l: Listing): ListingWithSeller {
    const seller = this.withRating(this.profiles.find((p) => p.id === l.sellerId)!);
    const clone = structuredClone(l);
    for (const img of clone.images) img.url = this.resolveImageUrl(img.storagePath);
    return {
      ...clone,
      seller,
      sellerActiveListingCount: this.listings.filter(
        (x) => x.sellerId === l.sellerId && x.status === 'active',
      ).length,
    };
  }

  async searchListings(filter: ListingFilter, offset: number, limit: number): Promise<ListingPage> {
    await sleep(netDelay());
    const matched = sortListings(
      this.listings.filter((l) => listingMatchesFilter(l, filter)),
      filter.sort,
    );
    const page = matched.slice(offset, offset + limit);
    return {
      items: page.map((l) => this.hydrate(l)),
      total: matched.length,
      hasMore: offset + limit < matched.length,
    };
  }

  async getListing(id: string): Promise<ListingWithSeller | null> {
    await sleep(netDelay());
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
    Object.assign(listing, input);
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
      this.emitConversation(conversationId, { type: 'read', conversationId });
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

  async getPendingReviews(): Promise<PendingReview[]> {
    const me = this.me();
    await sleep(netDelay());
    const out: PendingReview[] = [];
    for (const conv of this.conversations) {
      if (conv.buyerId !== me.id && conv.sellerId !== me.id) continue;
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
      revieweeId: conv.buyerId === me.id ? conv.sellerId : conv.buyerId,
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
  reviews: Review[];
  reports: ReportInput[];
  favorites: Array<[string, string[]]>;
  blocks: Array<[string, string[]]>;
}

type RemotePatch =
  | { type: 'hello' }
  | { type: 'snapshot'; state: SnapshotState }
  | { type: 'message'; message: Message }
  | { type: 'read'; conversationId: string; messageIds: string[]; at: string }
  | { type: 'listing'; listing: Listing }
  | { type: 'conversation'; conversation: Conversation }
  | { type: 'favorite'; userId: string; listingId: string; on: boolean }
  | { type: 'block'; blockerId: string; blockedId: string; on: boolean }
  | { type: 'review'; review: Review }
  | { type: 'report'; report: ReportInput }
  | { type: 'profile'; profile: Profile };
