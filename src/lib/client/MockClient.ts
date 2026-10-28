import type {
  AdminAction,
  AdminActionKind,
  AppNotification,
  AdminAuction,
  AdminListingFilter,
  AdminReview,
  AdminStats,
  AdminUser,
  Auction,
  AuctionDetail,
  AuctionInput,
  AuctionStatus,
  Bid,
  Conversation,
  ConversationSummary,
  Entitlements,
  ImageDraft,
  Listing,
  ListingFilter,
  ListingInput,
  ListingPage,
  ListingStatus,
  ListingWithSeller,
  Message,
  NotificationKind,
  PendingReview,
  OfferStatus,
  Plan,
  Profile,
  PurchaseKind,
  PurchaseRequest,
  PurchaseStatus,
  Report,
  ReportInput,
  ReportStatus,
  ListingScreen,
  ReviewQueueItem,
  ReviewState,
  ReportSubject,
  ReportTargetType,
  Review,
  SellerStats,
  SupportCategory,
  SupportMessage,
  SupportStatus,
  SupportTicket,
  UserWarning,
} from '../types';
import { WARNING_LIMIT } from '../types';
import { formatWait } from '../format';
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
  seedAdminProfiles,
  seedBidderProfiles,
  buildSeedConversations,
  buildSeedListings,
  buildStressListings,
  seedCreditPacks,
  seedFavorites,
  seedPlans,
  seedProfiles,
  seedReports,
  seedReviews,
  seedNotifications,
  seedSubscriptions,
} from '../../mock/seed';
import type { MockCreditPack, MockSubscription, StoredNotification } from '../../mock/seed';

/** Support rows as the mock keeps them (mirror of 0026). */
interface StoredTicket {
  id: string;
  userId: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  lastFrom: 'user' | 'staff';
  createdAt: string;
  updatedAt: string;
}
interface StoredSupportMessage {
  id: string;
  ticketId: string;
  senderId: string | null;
  fromStaff: boolean;
  body: string;
  createdAt: string;
}

/** A warning row as the mock keeps it (mirror of 0025). */
interface StoredWarning {
  id: string;
  userId: string;
  issuedBy: string | null;
  listingId: string | null;
  listingTitle: string | null;
  reason: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
}
import { avatarDataUrl, cardImageUrl } from '../../mock/cardImage';
import type { Condition, Finish, Game } from '../types';
import type { DefectAssessment, PregradeReport, PregradeReportInput } from '../pregrade/types';
import { MOCK_ASSESSMENTS, mockCaseFrom } from '../pregrade/mockAssessments';
import { pregradePillLabel } from '../pregrade/copy';
import { CURRENT_STANDARD } from '../pregrade/standards';
import { PHASH_MISMATCH_COPY } from '../pregrade/phash';
import { capturesMatchCover } from '../pregrade/phashGate';

const AUTH_KEY = 'lebanontcg.mock.currentUser';

/** Demo accounts that always read as online in mock mode, so the
    presence dot can be seen without a second tab. */
const MOCK_ALWAYS_ONLINE = ['u-maya', 'u-lina'];

/** Listings a new account gets before paying — free_listing_allowance() in 0019. */
const FREE_LISTING_ALLOWANCE = 3;

export interface MockClientOptions {
  /** The listing cap. Ships OFF (0021) until payments exist; tests of
      the paywall rules turn it on. */
  listingQuota?: boolean;
}

/** No-show grace period — mirrors migration 0016. */
const NO_SHOW_GRACE_MS = 24 * 60 * 60 * 1000;

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

  private profiles: Profile[] = structuredClone([
    ...seedProfiles,
    ...seedBidderProfiles,
    ...seedAdminProfiles,
  ]);
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
  private reports: StoredReport[] = structuredClone(seedReports) as StoredReport[];
  /** Append-only in mock too — nothing here ever deletes a row. */
  private adminActions: StoredAdminAction[] = [];
  /** Automatic photo checks per listing, newest first (0031). */
  private screens = new Map<string, ListingScreen[]>();
  /** Pre-grade reports live per-tab in mock mode (captures = object URLs). */
  private pregradeReports: PregradeReport[] = [];

  // ---- Warnings (mirrors migration 0025) ------------------------------------
  private warnings: StoredWarning[] = [];

  // ---- Support (mirrors migration 0026) -------------------------------------
  private tickets: StoredTicket[] = [
    {
      id: 't-1',
      userId: 'u-lina',
      subject: 'Photo upload fails on iPhone',
      category: 'bug',
      status: 'open',
      lastFrom: 'user',
      createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    },
  ];
  private supportMessages: StoredSupportMessage[] = [
    {
      id: 'sm-1',
      ticketId: 't-1',
      senderId: 'u-lina',
      fromStaff: false,
      body: 'HEIC photos from my iPhone 15 fail to upload — the cropper never opens.',
      createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    },
  ];
  private ticketListeners = new Map<string, Set<() => void>>();

  // ---- Notifications (mirrors migration 0024) ------------------------------
  private notifications: StoredNotification[] = structuredClone(seedNotifications);
  private notificationListeners = new Set<() => void>();
  private likeListeners = new Set<(listingId: string, likes: number) => void>();

  // ---- Paywall (mirrors migration 0019) ----------------------------------
  private plans: Plan[] = structuredClone(seedPlans);
  private subscriptions: MockSubscription[] = structuredClone(seedSubscriptions);
  private creditPacks: MockCreditPack[] = structuredClone(seedCreditPacks);
  /**
   * Listings created, ever, per seller. Deleting a listing does not hand
   * the free slot back, so this cannot be a count of live rows — same
   * reason listing_counters exists in the database.
   */
  private listingCounts = new Map<string, number>();

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
  /** userId -> tabId -> last heartbeat (ms): who is on the site. */
  private online = new Map<string, Map<string, number>>();
  private onlineListeners = new Set<(ids: Set<string>) => void>();
  private presenceListeners = new Map<string, Set<(count: number) => void>>();
  private presenceTimers = new Map<string, number>();

  /** Cross-tab sync so two tabs (two mock users) share one world. */
  private channel: BroadcastChannel | null = null;
  private snapshotApplied = false;

  /** Mirrors listing_quota_enabled() — false until payments exist. */
  private readonly listingQuota: boolean;

  constructor(options: MockClientOptions = {}) {
    this.listingQuota = options.listingQuota ?? false;
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
    for (const l of this.listings) {
      this.listingCounts.set(l.sellerId, (this.listingCounts.get(l.sellerId) ?? 0) + 1);
    }
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
        this.adminActions = s.adminActions ?? this.adminActions;
        this.notifications = s.notifications ?? this.notifications;
        this.warnings = s.warnings ?? this.warnings;
        this.tickets = s.tickets ?? this.tickets;
        this.supportMessages = s.supportMessages ?? this.supportMessages;
        this.subscriptions = s.subscriptions ?? this.subscriptions;
        this.creditPacks = s.creditPacks ?? this.creditPacks;
        this.listingCounts = new Map(s.listingCounts ?? [...this.listingCounts.entries()]);
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
        this.emitLikes(patch.listingId);
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
        const i = this.reports.findIndex((r) => r.id === patch.report.id);
        if (i >= 0) this.reports[i] = patch.report;
        else this.reports.push(patch.report);
        break;
      }
      case 'adminaction': {
        if (!this.adminActions.some((a) => a.id === patch.action.id)) {
          this.adminActions.unshift(patch.action);
        }
        break;
      }
      case 'credential': {
        this.credentials.set(patch.email, { userId: patch.userId, password: patch.password });
        break;
      }
      case 'online': {
        const tabs = this.online.get(patch.userId) ?? new Map<string, number>();
        if (patch.leaving) tabs.delete(patch.tabId);
        else tabs.set(patch.tabId, patch.at);
        this.online.set(patch.userId, tabs);
        this.emitOnline();
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
      case 'ticket': {
        const t = patch.ticket;
        const ti = this.tickets.findIndex((x) => x.id === t.id);
        if (ti >= 0) this.tickets[ti] = t;
        else this.tickets.unshift(t);
        if (patch.message && !this.supportMessages.some((m) => m.id === patch.message!.id)) {
          this.supportMessages.push(patch.message);
        }
        this.emitTicket(t.id);
        break;
      }
      case 'warning': {
        const w = patch.warning;
        const idx = this.warnings.findIndex((x) => x.id === w.id);
        if (idx >= 0) this.warnings[idx] = w;
        else this.warnings.unshift(w);
        break;
      }
      case 'notification': {
        const n = patch.notification;
        const idx = this.notifications.findIndex((x) => x.id === n.id);
        if (idx >= 0) this.notifications[idx] = n;
        else this.notifications.unshift(n);
        if (this.auth.user?.id === n.userId) this.emitNotifications();
        break;
      }
      case 'notifications-read': {
        for (const n of this.notifications) {
          if (n.userId === patch.userId && !n.readAt && (!patch.ids || patch.ids.includes(n.id))) {
            n.readAt = patch.at;
          }
        }
        if (this.auth.user?.id === patch.userId) this.emitNotifications();
        break;
      }
      case 'billing': {
        this.subscriptions = patch.subscriptions;
        this.creditPacks = patch.creditPacks;
        this.listingCounts = new Map(patch.listingCounts);
        break;
      }
      case 'noshow-retract': {
        this.noShows = this.noShows.filter(
          (n) => !(n.auctionId === patch.auctionId && n.reporterId === patch.reporterId),
        );
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
        else this.profiles.push(patch.profile);
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
      adminActions: this.adminActions,
      notifications: this.notifications,
      warnings: this.warnings,
      tickets: this.tickets,
      supportMessages: this.supportMessages,
      subscriptions: this.subscriptions,
      creditPacks: this.creditPacks,
      listingCounts: [...this.listingCounts.entries()],
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

  /** The mock of 0031's listing RLS: only approved listings are public;
      the seller, moderators and anyone already chatting about it still
      see one in review. */
  private canSee(l: Listing): boolean {
    if (l.reviewState === 'approved') return true;
    const uid = this.auth.user?.id;
    if (!uid) return false;
    if (l.sellerId === uid) return true;
    if (this.profiles.find((p) => p.id === uid)?.isAdmin) return true;
    return this.conversations.some((c) => c.listingId === l.id && c.buyerId === uid);
  }

  private requirePublic(l: Listing | undefined): void {
    if (l && l.reviewState !== 'approved') throw new Error('This listing is waiting for review.');
  }

  /** When each listing last went to review (created, or given new photos). */
  private reviewRequestedAt = new Map<string, number>();

  /** 0033's listing_cooldown_until: every listing in review counts (however
      it got there) until it's approved. Two in a row, or two within five
      minutes, pause listing for ten minutes from the second. `exclude`
      leaves out the listing being edited. */
  private cooldownUntil(userId: string, exclude: string | null = null): number {
    const seq = this.listings
      .filter((l) => l.sellerId === userId && l.id !== exclude && this.reviewRequestedAt.has(l.id))
      .map((l) => ({ id: l.id, at: this.reviewRequestedAt.get(l.id)!, flagged: l.reviewState !== 'approved' }))
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    const now = Date.now();
    let until = 0;
    seq.forEach((d, i) => {
      if (!d.flagged || d.at <= now - 10 * 60_000) return;
      const inARow = i > 0 && seq[i - 1].flagged;
      const close = seq.some(
        (e) => e.flagged && e.id !== d.id && e.at <= d.at && e.at >= d.at - 5 * 60_000,
      );
      if (inARow || close) until = Math.max(until, d.at + 10 * 60_000);
    });
    return until;
  }

  private requireNoCooldown(userId: string, exclude: string | null = null): void {
    const left = Math.ceil((this.cooldownUntil(userId, exclude) - Date.now()) / 1000);
    if (left > 0) throw new Error(`You can't list at the moment. Try again in ${formatWait(left)}.`);
  }

  /**
   * The mock equivalent of the RLS `not is_suspended()` clauses in 0016:
   * a suspended account can read and be read, but creates nothing new.
   */
  private meActive(): Profile {
    const me = this.me();
    const live = this.profiles.find((p) => p.id === me.id) ?? me;
    if (live.suspendedAt) {
      throw new Error(
        live.suspendedReason
          ? `Your account is suspended: ${live.suspendedReason}`
          : 'Your account is suspended.',
      );
    }
    return me;
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
      isAdmin: false,
      suspendedAt: null,
      suspendedReason: null,
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
    const me = this.meActive();
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
    const me = this.meActive();
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
    let candidates = this.listings.filter(
      (l) => l.reviewState === 'approved' && listingMatchesFilter(l, filter),
    );
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
    return l && this.canSee(l) ? this.hydrate(l) : null;
  }

  async getListingsBySeller(sellerId: string, statuses: ListingStatus[]): Promise<Listing[]> {
    await sleep(netDelay());
    return sortListings(
      this.listings.filter(
        (l) => l.sellerId === sellerId && statuses.includes(l.status) && this.canSee(l),
      ),
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
    const me = this.meActive();
    await sleep(netDelay());
    this.requireNoCooldown(me.id);
    this.chargeListingQuota(me.id);
    const id = nextId('l');
    this.reviewRequestedAt.set(id, Date.now());
    const nowIso = new Date().toISOString();
    const listing: Listing = {
      id,
      sellerId: me.id,
      ...input,
      status: 'active',
      saleType: 'fixed',
      reservedForConversationId: null,
      reviewState: 'pending',
      reviewNote: null,
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
    const me = this.meActive();
    const listing = this.listings.find((l) => l.id === id);
    if (!listing) throw new Error('Listing not found');
    if (listing.sellerId !== me.id) throw new Error('Only the seller can edit a listing');
    if (images.some((img) => img.kind === 'new')) this.requireNoCooldown(me.id, id);
    const priorPrice = listing.price;
    Object.assign(listing, input);
    // An auction listing's price mirrors the current bid — edits can't move it.
    if (listing.saleType === 'auction') listing.price = priorPrice;
    listing.updatedAt = new Date().toISOString();
    if (listing.status === 'active' && listing.price < priorPrice) {
      for (const [userId, favs] of this.favorites) {
        if (favs.has(id)) {
          this.notify(userId, 'watch', `Price drop — ${listing.title}`,
            `Now ${this.money(listing.price, listing.currency)}, was ${Math.round(priorPrice).toLocaleString('en-US')}`,
            `/listing/${id}`, me.id, `price:${id}`);
        }
      }
    }
    // New photos mean a new look at the listing (0031).
    if (images.some((img) => img.kind === 'new') && listing.reviewState !== 'pending') {
      listing.reviewState = 'pending';
      listing.reviewNote = null;
      this.reviewRequestedAt.set(id, Date.now());
    }
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

  async getListingCooldown(): Promise<number> {
    const uid = this.auth.user?.id;
    if (!uid) return 0;
    return Math.max(0, Math.ceil((this.cooldownUntil(uid) - Date.now()) / 1000));
  }

  async screenListing(listingId: string): Promise<ReviewState> {
    const me = this.meActive();
    await sleep(netDelay() + 600);
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing || listing.sellerId !== me.id) return 'pending';
    if (listing.reviewState !== 'pending') return listing.reviewState;
    // Stand-in for the vision check: a listing with photos is a card,
    // unless its title says "junk" (so the queue can be demoed).
    const card = listing.images.length > 0 && !/junk/i.test(listing.title);
    const screen: ListingScreen = {
      verdict: card ? 'card' : 'not_card',
      reason: card
        ? 'The photos show a trading card.'
        : listing.images.length === 0
          ? 'No photos could be checked.'
          : 'The photos do not show a trading card.',
      createdAt: new Date().toISOString(),
    };
    this.screens.set(listingId, [screen, ...(this.screens.get(listingId) ?? [])]);
    const turnedDown = this.adminActions.some(
      (a) => a.kind === 'listing_reject' && a.targetId === listingId,
    );
    if (card && !turnedDown) {
      listing.reviewState = 'approved';
      listing.reviewNote = null;
    } else {
      for (const p of this.profiles) {
        if (p.isAdmin) {
          this.notify(p.id, 'moderation', 'Listing waiting for review',
            `${listing.title} — ${screen.reason}`, '/admin?tab=review', me.id, `review:${listingId}`);
        }
      }
    }
    this.emitListing(listing);
    this.broadcast({ type: 'listing', listing: structuredClone(listing) });
    return listing.reviewState;
  }

  async setListingStatus(
    id: string,
    status: ListingStatus,
    opts?: { reservedForConversationId?: string | null },
  ): Promise<Listing> {
    const me = this.meActive();
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

    if (status === 'sold') {
      for (const [userId, favs] of this.favorites) {
        if (favs.has(id)) {
          this.notify(userId, 'watch', `Sold — ${listing.title}`,
            'A card on your watchlist found a buyer.', `/listing/${id}`, me.id);
        }
      }
    }

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
      if (
        a.status === 'live' &&
        new Date(a.endsAt).getTime() <= Date.now() &&
        this.listings.find((l) => l.id === a.listingId)?.reviewState === 'approved'
      ) {
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
      this.notify(
        top.bidderId,
        'auction',
        `You won ${listing?.title ?? 'the auction'}`,
        `At ${this.money(top.amount, a.currency)} — the chat with the seller is open.`,
        `/listing/${a.listingId}`,
      );
      this.notify(
        a.sellerId,
        'auction',
        `Your auction ended — ${listing?.title ?? ''}`,
        `Won by ${this.handleOfId(top.bidderId)} at ${this.money(top.amount, a.currency)}`,
        `/listing/${a.listingId}`,
        top.bidderId,
      );
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
      this.notify(
        a.sellerId,
        'auction',
        `Your auction ended — ${listing?.title ?? ''}`,
        'No winner this time. You can relist it.',
        `/listing/${a.listingId}`,
      );
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
    const me = this.meActive();
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
    const w = auction.winnerId
      ? this.profiles.find((p) => p.id === auction.winnerId)
      : undefined;
    const winner = w ? { id: w.id, username: w.username, displayName: w.displayName } : null;
    return structuredClone({ auction, bids, winner, myNoShowReported });
  }

  /** The rules, mirrored from place_bid — used by the signed-in user
      and by the scripted mock bidders alike. */
  private placeBidAs(bidder: Profile, auctionId: string, amount: number): PlacedBid {
    this.lazyCloseAuctions();
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    this.requirePublic(this.listings.find((l) => l.id === a.listingId));
    if (a.status !== 'live' || new Date(a.endsAt).getTime() <= Date.now()) {
      throw new Error('This auction has ended.');
    }
    if (a.sellerId === bidder.id) throw new Error('Sellers cannot bid on their own auction.');
    if (this.isBlockedBetween(bidder.id, a.sellerId)) {
      throw new Error('You cannot bid on this auction.');
    }
    if (this.isBidBanned(bidder.id)) {
      const suspended = this.profiles.find((p) => p.id === bidder.id)?.suspendedAt;
      throw new Error(
        suspended
          ? 'Bidding is blocked while this account is suspended.'
          : 'Bidding is blocked on this account after repeated no-shows.',
      );
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
    const prevTop = top && top.bidderId !== bidder.id ? top.bidderId : null;
    this.bids.push(bid);
    {
      const l = this.listings.find((x) => x.id === a.listingId);
      const title = l?.title ?? 'your auction';
      this.notify(
        a.sellerId,
        'bid',
        `New bid on ${title}`,
        `${this.handleOf(bidder)} bid ${this.money(amount, a.currency)}`,
        `/listing/${a.listingId}`,
        bidder.id,
        `auction:${a.id}`,
      );
      if (prevTop) {
        this.notify(
          prevTop,
          'outbid',
          `You were outbid on ${title}`,
          `The bid is now ${this.money(amount, a.currency)}`,
          `/listing/${a.listingId}`,
          bidder.id,
          `outbid:${a.id}`,
        );
      }
    }
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
    const me = this.meActive();
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
    const me = this.meActive();
    await sleep(netDelay());
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    if (a.sellerId !== me.id) throw new Error('Only the seller can end this auction.');
    if (a.status !== 'live') throw new Error('This auction is not live.');
    a.endsAt = new Date().toISOString();
    this.closeAuction(a);
  }

  async cancelAuction(auctionId: string, reason: string): Promise<void> {
    const me = this.meActive();
    await sleep(netDelay());
    this.cancelAuctionAs(me, auctionId, reason);
  }

  private cancelAuctionAs(
    actor: Profile,
    auctionId: string,
    reason: string,
    opts: { byModerator?: boolean } = {},
  ): void {
    if (!reason || reason.trim().length < 3) throw new Error('A cancellation reason is required.');
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    if (!opts.byModerator && a.sellerId !== actor.id) {
      throw new Error('Only the seller can cancel this auction.');
    }
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
      this.notify(
        bidderId,
        'auction',
        `Auction cancelled — ${this.listings.find((x) => x.id === a.listingId)?.title ?? ''}`,
        a.cancelReason ?? '',
        `/listing/${a.listingId}`,
      );
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
        body: `${opts.byModerator ? 'A moderator' : 'The seller'} cancelled this auction. Reason: ${a.cancelReason}`,
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

  /** Mirrors is_bid_banned (0015, widened in 0016): a suspended account,
      or three winner-role no-shows in 90 days. */
  private isBidBanned(userId: string): boolean {
    if (this.profiles.find((p) => p.id === userId)?.suspendedAt) return true;
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
    const me = this.meActive();
    await sleep(netDelay());
    const a = this.auctions.find((x) => x.id === auctionId);
    if (!a) throw new Error('Auction not found.');
    if (a.status !== 'closed' || !a.winnerId) {
      throw new Error('No-shows can only be reported on a closed auction with a winner.');
    }
    // Mirrors report_auction_no_show (0016): nobody fails to follow
    // through within a day of winning.
    if (Date.now() < new Date(a.endsAt).getTime() + NO_SHOW_GRACE_MS) {
      throw new Error('Give them a day — no-shows can be reported 24 hours after the close.');
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
    // Mirrors 0015: every no-show also lands in the moderation queue so
    // the pattern is visible to admins.
    const report: StoredReport = {
      id: nextId('r'),
      reporterId: me.id,
      targetType: 'user',
      targetId: reportedId,
      reason: 'other',
      detail: `Auction no-show (${role}) on auction ${auctionId}`,
      status: 'open',
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt: new Date().toISOString(),
    };
    this.reports.push(report);
    this.broadcast({ type: 'noshow', noShow: structuredClone(noShow) });
    this.broadcast({ type: 'report', report: structuredClone(report) });
  }

  async getAuctionsBySeller(sellerId: string): Promise<Auction[]> {
    await sleep(netDelay());
    this.lazyCloseAuctions();
    return structuredClone(
      this.auctions
        .filter((a) => a.sellerId === sellerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async retractAuctionNoShow(auctionId: string): Promise<void> {
    const me = this.meActive();
    await sleep(netDelay());
    const i = this.noShows.findIndex(
      (n) => n.auctionId === auctionId && n.reporterId === me.id,
    );
    if (i < 0) throw new Error('Nothing to retract.');
    const [gone] = this.noShows.splice(i, 1);
    const detail = `Auction no-show (${gone.role}) on auction ${auctionId}`;
    const r = this.reports.findIndex((x) => x.detail === detail);
    if (r >= 0) this.reports.splice(r, 1);
    this.broadcast({ type: 'noshow-retract', auctionId, reporterId: me.id });
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
    const me = this.meActive();
    const favs = this.myFavorites();
    if (favorited) this.requirePublic(this.listings.find((l) => l.id === listingId));
    if (favorited) favs.add(listingId);
    else favs.delete(listingId);
    this.broadcast({ type: 'favorite', userId: me.id, listingId, on: favorited });
    this.emitLikes(listingId);
  }

  private emitLikes(listingId: string): void {
    const likes = this.likesOf(listingId);
    for (const cb of this.likeListeners) cb(listingId, likes);
  }

  subscribeToLikeCounts(cb: (listingId: string, likes: number) => void): Unsubscribe {
    this.likeListeners.add(cb);
    return () => this.likeListeners.delete(cb);
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
      unreadCount: msgs.filter((m) => (m.kind === 'user' || m.kind === 'phone' || m.kind === 'location') && m.senderId !== me.id && !m.readAt).length,
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
    const me = this.meActive();
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
    this.requirePublic(listing);
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
    return this.postMessage(conversationId, 'user', body, clientId, body.slice(0, 140));
  }

  async sharePhone(conversationId: string, phone: string, clientId: string): Promise<Message> {
    // Mirrors 0028's phone_shape check.
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error('That doesn’t look like a phone number.');
    return this.postMessage(conversationId, 'phone', phone, clientId, 'Shared their phone number');
  }

  async shareLocation(
    conversationId: string,
    point: { latitude: number; longitude: number },
    place: string,
    clientId: string,
  ): Promise<Message> {
    // Mirrors 0029's location_shape check.
    const { latitude, longitude } = point;
    const label = place.trim() || 'Location';
    if (
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || label.length > 120
    ) {
      throw new Error('That location couldn’t be shared.');
    }
    return this.postMessage(conversationId, 'location', label, clientId, 'Shared a location', {
      latitude,
      longitude,
    });
  }

  private async postMessage(
    conversationId: string,
    kind: 'user' | 'phone' | 'location',
    body: string,
    clientId: string,
    notifyBody: string,
    point?: { latitude: number; longitude: number },
  ): Promise<Message> {
    const me = this.meActive();
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
      kind,
      body,
      amount: null,
      offerStatus: null,
      createdAt: new Date().toISOString(),
      readAt: null,
      clientId,
      ...(point ?? {}),
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
    {
      const l = this.listings.find((x) => x.id === conv.listingId);
      this.notify(
        otherId,
        'message',
        `${this.handleOf(me)} · ${l?.title ?? 'a listing'}`,
        notifyBody,
        `/chat/${conversationId}`,
        me.id,
        `conv:${conversationId}`,
      );
    }
    return structuredClone(message);
  }

  async sendOffer(
    conversationId: string,
    amount: number,
    note: string,
    clientId: string,
  ): Promise<Message> {
    const me = this.meActive();
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
    {
      const l = this.listings.find((x) => x.id === conv.listingId);
      this.notify(
        otherId,
        'offer',
        `${this.handleOf(me)} offered ${this.money(amount, l?.currency ?? 'USD')}`,
        l?.title ?? '',
        `/chat/${conversationId}`,
        me.id,
      );
    }
    return structuredClone(message);
  }

  async respondToOffer(conversationId: string, messageId: string, accept: boolean): Promise<void> {
    const me = this.meActive();
    const msg = this.messages.find((m) => m.id === messageId && m.conversationId === conversationId);
    if (!msg || msg.kind !== 'offer') throw new Error('Offer not found');
    if (msg.senderId === me.id) throw new Error('You cannot respond to your own offer.');
    if (msg.offerStatus !== 'proposed') throw new Error('This offer was already settled.');
    const status: OfferStatus = accept ? 'accepted' : 'declined';
    msg.offerStatus = status;
    {
      const conv0 = this.conversations.find((c) => c.id === conversationId);
      const l = conv0 ? this.listings.find((x) => x.id === conv0.listingId) : undefined;
      this.notify(
        msg.senderId,
        'offer',
        `Your offer of ${this.money(msg.amount ?? 0, l?.currency ?? 'USD')} was ${status}`,
        l?.title ?? '',
        `/chat/${conversationId}`,
        me.id,
      );
    }
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
        (m.kind === 'user' || m.kind === 'phone' || m.kind === 'location') &&
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
      (m) => myConvIds.has(m.conversationId) && (m.kind === 'user' || m.kind === 'phone' || m.kind === 'location') && m.senderId !== me.id && !m.readAt,
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
    const me = this.meActive();
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
    this.notify(
      conv.sellerId,
      'review',
      `${this.handleOf(me)} left you a ${rating}-star review`,
      body.slice(0, 140),
      '/reviews',
      me.id,
    );
    this.broadcast({ type: 'review', review: structuredClone(review) });
    return structuredClone(review);
  }

  async submitReport(input: ReportInput): Promise<void> {
    const me = this.meActive();
    await sleep(netDelay());
    const report: StoredReport = {
      id: nextId('r'),
      reporterId: me.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      detail: input.detail,
      status: 'open',
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt: new Date().toISOString(),
    };
    this.reports.push(report);
    this.broadcast({ type: 'report', report: structuredClone(report) });
  }

  async getBlockedIds(): Promise<Set<string>> {
    if (!this.auth.user) return new Set();
    return new Set(this.blocks.get(this.auth.user.id) ?? []);
  }

  async setBlocked(userId: string, blocked: boolean): Promise<void> {
    const me = this.meActive();
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
    const me = this.meActive();
    // Vision-model calls cost money: subscribers and admins only (0019).
    if (!this.canUsePregradeFor(me.id)) {
      throw new Error('Pre-Grade is part of a subscription — subscribe to run it.');
    }
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
    const me = this.meActive();
    if (!this.canUsePregradeFor(me.id)) {
      throw new Error('Pre-Grade is part of a subscription — subscribe to run it.');
    }
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
    const me = this.meActive();
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
    const me = this.meActive();
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
    const me = this.meActive();
    await sleep(netDelay());
    const r = this.pregradeReports.find((x) => x.id === reportId && x.userId === me.id);
    if (!r) throw new Error('Report not found.');
    r.outcome = {
      actualGrade,
      certNumber: certNumber ?? null,
      reportedAt: new Date().toISOString(),
    };
  }

  // ---- Support --------------------------------------------------------------
  // Mirrors 0026: anyone signed in opens a ticket (suspended included),
  // only the owner and moderators see it, closing is a moderator's call,
  // and a staff reply reopens.

  private emitTicket(id: string): void {
    for (const cb of this.ticketListeners.get(id) ?? []) cb();
  }

  private notifyStaff(title: string, body: string, href: string, actorId: string, dedupe: string): void {
    for (const p of this.profiles) {
      if (p.isAdmin) this.notify(p.id, 'support', title, body, href, actorId, dedupe);
    }
  }

  private toTicket(t: StoredTicket, withUser: boolean): SupportTicket {
    return {
      id: t.id,
      userId: t.userId,
      user: withUser ? this.profileById(t.userId) : null,
      subject: t.subject,
      category: t.category,
      status: t.status,
      lastFrom: t.lastFrom,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messageCount: this.supportMessages.filter((m) => m.ticketId === t.id).length,
    };
  }

  private pushTicketMessage(t: StoredTicket, senderId: string | null, fromStaff: boolean, body: string): StoredSupportMessage {
    const m: StoredSupportMessage = {
      id: nextId('sm'),
      ticketId: t.id,
      senderId,
      fromStaff,
      body,
      createdAt: new Date().toISOString(),
    };
    this.supportMessages.push(m);
    t.updatedAt = m.createdAt;
    this.broadcast({ type: 'ticket', ticket: structuredClone(t), message: structuredClone(m) });
    this.emitTicket(t.id);
    return m;
  }

  async listMyTickets(): Promise<SupportTicket[]> {
    if (!this.auth.user) return [];
    await sleep(netDelay());
    const me = this.auth.user.id;
    return this.tickets
      .filter((t) => t.userId === me)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((t) => this.toTicket(t, false));
  }

  async openSupportTicket(subject: string, category: SupportCategory, body: string): Promise<string> {
    const me = this.me(); // not meActive(): a suspended account can appeal
    await sleep(netDelay());
    if (subject.trim().length < 3) throw new Error('Give the ticket a subject.');
    if (body.trim().length < 1) throw new Error('Say what you need.');
    if (this.tickets.filter((t) => t.userId === me.id && t.status === 'open').length >= 5) {
      throw new Error('You already have five open tickets — add to one of those.');
    }
    const now = new Date().toISOString();
    const t: StoredTicket = {
      id: nextId('t'),
      userId: me.id,
      subject: subject.trim(),
      category,
      status: 'open',
      lastFrom: 'user',
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.unshift(t);
    this.pushTicketMessage(t, me.id, false, body.trim());
    this.notifyStaff(
      `New ticket — ${t.subject}`,
      `${this.handleOf(me)}: ${body.trim().slice(0, 140)}`,
      `/admin?tab=support&ticket=${t.id}`,
      me.id,
      `ticket:${t.id}`,
    );
    return t.id;
  }

  async getSupportTicket(id: string): Promise<{ ticket: SupportTicket; messages: SupportMessage[] } | null> {
    const me = this.me();
    await sleep(netDelay());
    const t = this.tickets.find((x) => x.id === id);
    if (!t) return null;
    if (t.userId !== me.id && !this.isAdminId(me.id)) return null;
    return {
      ticket: this.toTicket(t, true),
      messages: this.supportMessages
        .filter((m) => m.ticketId === id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({
          id: m.id,
          ticketId: m.ticketId,
          sender: m.senderId ? this.profileById(m.senderId) : null,
          fromStaff: m.fromStaff,
          body: m.body,
          createdAt: m.createdAt,
        })),
    };
  }

  async replySupportTicket(id: string, body: string): Promise<void> {
    const me = this.me();
    await sleep(netDelay());
    if (body.trim().length < 1) throw new Error('Write something first.');
    const t = this.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    const staff = this.isAdminId(me.id);
    if (t.userId !== me.id && !staff) throw new Error('Not your ticket.');
    if (t.status === 'closed' && !staff) throw new Error('This ticket is closed — open a new one.');
    if (staff && t.status === 'closed') t.status = 'open';
    t.lastFrom = staff ? 'staff' : 'user';
    this.pushTicketMessage(t, me.id, staff, body.trim());
    if (staff) {
      this.notify(t.userId, 'support', `Support replied — ${t.subject}`, body.trim().slice(0, 140), `/support/${t.id}`, me.id, `ticket:${t.id}`);
    } else {
      this.notifyStaff(`Reply on ticket — ${t.subject}`, `${this.handleOf(me)}: ${body.trim().slice(0, 140)}`, `/admin?tab=support&ticket=${t.id}`, me.id, `ticket:${t.id}`);
    }
  }

  subscribeToSupportTicket(id: string, cb: () => void): Unsubscribe {
    if (!this.ticketListeners.has(id)) this.ticketListeners.set(id, new Set());
    this.ticketListeners.get(id)!.add(cb);
    return () => this.ticketListeners.get(id)?.delete(cb);
  }

  // ---- Warnings -------------------------------------------------------------
  // Mirrors 0025: a reason is required, the third active warning suspends
  // through adminSetSuspended, revoking never unsuspends.

  private activeWarnings(userId: string): number {
    return this.warnings.filter((w) => w.userId === userId && !w.revokedAt).length;
  }

  private toWarning(w: StoredWarning): UserWarning {
    return {
      id: w.id,
      userId: w.userId,
      issuedBy: w.issuedBy ? this.profileById(w.issuedBy) : null,
      listingId: w.listingId,
      listingTitle: w.listingTitle,
      reason: w.reason,
      createdAt: w.createdAt,
      revokedAt: w.revokedAt,
      revokedBy: w.revokedBy ? this.profileById(w.revokedBy) : null,
      revokeReason: w.revokeReason,
    };
  }

  async listMyWarnings(): Promise<UserWarning[]> {
    if (!this.auth.user) return [];
    await sleep(netDelay());
    const me = this.auth.user.id;
    return this.warnings
      .filter((w) => w.userId === me)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((w) => this.toWarning(w));
  }

  // ---- Presence: who is on the site ----------------------------------------
  // Same shape as the auction rooms: heartbeats per tab, pruned after
  // 12 seconds of silence. A few seeded accounts are always "online" so
  // the dot is demonstrable in a single tab.

  private onlineIds(): Set<string> {
    const now = Date.now();
    const ids = new Set<string>(MOCK_ALWAYS_ONLINE);
    for (const [userId, tabs] of this.online) {
      for (const [tabId, at] of tabs) {
        if (now - at > 12_000) tabs.delete(tabId);
      }
      if (tabs.size > 0) ids.add(userId);
    }
    return ids;
  }

  private emitOnline(): void {
    const ids = this.onlineIds();
    for (const cb of this.onlineListeners) cb(new Set(ids));
  }

  subscribeToOnline(cb: (onlineUserIds: Set<string>) => void): Unsubscribe {
    this.onlineListeners.add(cb);
    const me = this.auth.user?.id ?? null;
    const beat = () => {
      if (!me) return;
      const tabs = this.online.get(me) ?? new Map<string, number>();
      tabs.set(tabId, Date.now());
      this.online.set(me, tabs);
      this.broadcast({ type: 'online', userId: me, tabId, at: Date.now() });
    };
    beat();
    cb(this.onlineIds());
    const heartbeat = window.setInterval(() => {
      beat();
      this.emitOnline();
    }, 4_000);
    return () => {
      this.onlineListeners.delete(cb);
      window.clearInterval(heartbeat);
      if (me) {
        this.online.get(me)?.delete(tabId);
        this.broadcast({ type: 'online', userId: me, tabId, at: Date.now(), leaving: true });
      }
    };
  }

  // ---- Notifications -----------------------------------------------------
  // Mirrors 0024: the same events, the same copy, the same dedupe — one
  // live row per thread or auction — and nobody hears about their own
  // actions.

  private emitNotifications(): void {
    for (const cb of this.notificationListeners) cb();
  }

  private handleOfId(userId: string | null | undefined): string {
    const p = userId ? this.profiles.find((x) => x.id === userId) : undefined;
    return p ? this.handleOf(p) : 'Someone';
  }

  private money(amount: number, currency: string): string {
    return `${Math.round(amount).toLocaleString('en-US')} ${currency}`;
  }

  private notify(
    userId: string | null | undefined,
    kind: NotificationKind,
    title: string,
    body: string,
    href: string,
    actorId: string | null = null,
    dedupeKey: string | null = null,
  ): void {
    if (!userId || userId === actorId) return;
    const now = new Date().toISOString();
    if (dedupeKey) {
      const live = this.notifications.find(
        (n) => n.userId === userId && n.dedupeKey === dedupeKey && !n.readAt,
      );
      if (live) {
        live.title = title.slice(0, 160);
        live.body = body.slice(0, 400);
        live.actorId = actorId;
        live.createdAt = now;
        this.broadcast({ type: 'notification', notification: structuredClone(live) });
        if (this.auth.user?.id === userId) this.emitNotifications();
        return;
      }
    }
    const n: StoredNotification = {
      id: nextId('n'),
      userId,
      kind,
      title: title.slice(0, 160),
      body: body.slice(0, 400),
      href,
      actorId,
      dedupeKey,
      createdAt: now,
      readAt: null,
    };
    this.notifications.unshift(n);
    this.broadcast({ type: 'notification', notification: structuredClone(n) });
    if (this.auth.user?.id === userId) this.emitNotifications();
  }

  private toNotification(n: StoredNotification): AppNotification {
    return {
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      actor: n.actorId ? this.profileById(n.actorId) : null,
      createdAt: n.createdAt,
      readAt: n.readAt,
    };
  }

  async listNotifications(limit: number): Promise<AppNotification[]> {
    if (!this.auth.user) return [];
    await sleep(netDelay());
    const me = this.auth.user.id;
    return this.notifications
      .filter((n) => n.userId === me)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((n) => this.toNotification(n));
  }

  async getUnreadNotificationCount(): Promise<number> {
    if (!this.auth.user) return 0;
    const me = this.auth.user.id;
    return this.notifications.filter((n) => n.userId === me && !n.readAt).length;
  }

  async markNotificationsRead(ids?: string[]): Promise<void> {
    const me = this.me();
    await sleep(netDelay());
    const at = new Date().toISOString();
    for (const n of this.notifications) {
      if (n.userId === me.id && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = at;
    }
    this.broadcast({ type: 'notifications-read', userId: me.id, ids: ids ?? null, at });
    this.emitNotifications();
  }

  subscribeToNotifications(cb: () => void): Unsubscribe {
    this.notificationListeners.add(cb);
    return () => this.notificationListeners.delete(cb);
  }

  // ---- Plans and entitlements --------------------------------------------
  // Mirrors 0019: the same free allowance, the same credit spending order,
  // the same Pre-Grade gate, and the same rejection copy — so the paywall
  // can be walked end to end offline.

  private isAdminId(userId: string): boolean {
    return Boolean(this.profiles.find((p) => p.id === userId)?.isAdmin);
  }

  private activeSubscription(userId: string): MockSubscription | null {
    const now = Date.now();
    return (
      this.subscriptions.find(
        (sub) =>
          sub.userId === userId &&
          sub.status === 'active' &&
          (!sub.periodEnd || Date.parse(sub.periodEnd) > now),
      ) ?? null
    );
  }

  private creditsRemaining(userId: string): number {
    return this.creditPacks
      .filter((pk) => pk.userId === userId && pk.status === 'active')
      .reduce((sum, pk) => sum + (pk.credits - pk.used), 0);
  }

  private listingsCreated(userId: string): number {
    return this.listingCounts.get(userId) ?? 0;
  }

  private canCreateListingFor(userId: string): boolean {
    return (
      !this.listingQuota ||
      this.isAdminId(userId) ||
      Boolean(this.activeSubscription(userId)) ||
      this.listingsCreated(userId) < FREE_LISTING_ALLOWANCE ||
      this.creditsRemaining(userId) > 0
    );
  }

  private canUsePregradeFor(userId: string): boolean {
    return this.isAdminId(userId) || Boolean(this.activeSubscription(userId));
  }

  /** The quota, charged where listings are born. Throws the same message
      the database trigger raises. */
  private chargeListingQuota(userId: string): void {
    if (!this.listingQuota || this.isAdminId(userId) || this.activeSubscription(userId)) {
      this.listingCounts.set(userId, this.listingsCreated(userId) + 1);
      return;
    }
    if (this.listingsCreated(userId) >= FREE_LISTING_ALLOWANCE) {
      // Spend the oldest pack with room left.
      const pack = this.creditPacks
        .filter((pk) => pk.userId === userId && pk.status === 'active' && pk.used < pk.credits)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!pack) {
        throw new Error(
          `Listing limit reached: your ${FREE_LISTING_ALLOWANCE} free listings are used — buy listings or subscribe.`,
        );
      }
      pack.used += 1;
    }
    this.listingCounts.set(userId, this.listingsCreated(userId) + 1);
  }

  private broadcastBilling(): void {
    this.broadcast({
      type: 'billing',
      subscriptions: structuredClone(this.subscriptions),
      creditPacks: structuredClone(this.creditPacks),
      listingCounts: [...this.listingCounts.entries()],
    });
  }

  async listPlans(): Promise<Plan[]> {
    await sleep(netDelay());
    return structuredClone(this.plans).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getEntitlements(): Promise<Entitlements | null> {
    if (!this.auth.user) return null;
    await sleep(netDelay());
    const id = this.auth.user.id;
    const sub = this.activeSubscription(id);
    return {
      quotaEnabled: this.listingQuota,
      isAdmin: this.isAdminId(id),
      subscribed: Boolean(sub),
      tier: sub?.tier ?? null,
      periodEnd: sub?.periodEnd ?? null,
      freeAllowance: FREE_LISTING_ALLOWANCE,
      listingsCreated: this.listingsCreated(id),
      creditsRemaining: this.creditsRemaining(id),
      canCreateListing: this.canCreateListingFor(id),
      canUsePregrade: this.canUsePregradeFor(id),
      pendingRequests:
        this.subscriptions.filter((sub2) => sub2.userId === id && sub2.status === 'pending')
          .length +
        this.creditPacks.filter((pk) => pk.userId === id && pk.status === 'pending').length,
    };
  }

  async requestPurchase(planCode: string, note: string): Promise<void> {
    const me = this.meActive();
    await sleep(netDelay());
    const plan = this.plans.find((pl) => pl.code === planCode);
    if (!plan) throw new Error('Unknown plan.');
    const createdAt = new Date().toISOString();
    if (plan.kind === 'subscription') {
      if (this.subscriptions.some((sub) => sub.userId === me.id && sub.status === 'pending')) {
        throw new Error('You already have a subscription request waiting.');
      }
      this.subscriptions.push({
        id: nextId('sub'),
        userId: me.id,
        planCode: plan.code,
        tier: plan.tier ?? 'monthly',
        status: 'pending',
        periodStart: null,
        periodEnd: null,
        note,
        createdAt,
      });
    } else {
      this.creditPacks.push({
        id: nextId('pack'),
        userId: me.id,
        planCode: plan.code,
        credits: plan.credits ?? 0,
        used: 0,
        status: 'pending',
        note,
        createdAt,
      });
    }
    this.broadcastBilling();
  }

  // ---- Admin --------------------------------------------------------------
  // Mirrors 0016: the same rules the security-definer RPCs enforce, and the
  // same audit trail. Rejections read exactly as the SQL ones do, so a
  // moderator sees the same copy in mock and live.

  private requireAdmin(): Profile {
    const me = this.me();
    const live = this.profiles.find((p) => p.id === me.id);
    if (!live?.isAdmin) throw new Error('This action is restricted to admins.');
    return live;
  }

  private logAdmin(
    actor: Profile,
    kind: AdminActionKind,
    targetType: string,
    targetId: string,
    reason: string,
    detail: Record<string, unknown> = {},
  ): void {
    const action: StoredAdminAction = {
      id: nextId('aa'),
      actorId: actor.id,
      kind,
      targetType,
      targetId,
      reason: reason.trim(),
      detail,
      createdAt: new Date().toISOString(),
    };
    this.adminActions.unshift(action);
    this.broadcast({ type: 'adminaction', action: structuredClone(action) });
  }

  private profileById(id: string): Profile | null {
    const p = this.profiles.find((x) => x.id === id);
    return p ? this.withRating(p) : null;
  }

  /** Resolve what a report points at so the queue row reads on its own. */
  private reportSubject(r: StoredReport): ReportSubject | null {
    if (r.targetType === 'listing') {
      const l = this.listings.find((x) => x.id === r.targetId);
      if (!l) return null;
      const owner = this.profiles.find((p) => p.id === l.sellerId) ?? null;
      return {
        kind: 'listing',
        label: l.title,
        href: `/listing/${l.id}`,
        ownerId: l.sellerId,
        ownerName: owner ? this.handleOf(owner) : null,
      };
    }
    if (r.targetType === 'user') {
      const u = this.profiles.find((x) => x.id === r.targetId);
      if (!u) return null;
      return {
        kind: 'user',
        label: this.handleOf(u),
        href: u.username ? `/u/${u.username}` : null,
        ownerId: u.id,
        ownerName: this.handleOf(u),
      };
    }
    const m = this.messages.find((x) => x.id === r.targetId);
    if (!m) return null;
    const sender = this.profiles.find((p) => p.id === m.senderId) ?? null;
    return {
      kind: 'message',
      label: m.body,
      // Moderators read the reported message, not the thread around it.
      href: null,
      ownerId: m.senderId || null,
      ownerName: sender ? this.handleOf(sender) : null,
    };
  }

  private toReport(r: StoredReport): Report {
    return {
      id: r.id,
      reporterId: r.reporterId,
      reporter: this.profileById(r.reporterId),
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt,
      resolutionNote: r.resolutionNote,
      createdAt: r.createdAt,
      subject: this.reportSubject(r),
    };
  }

  async getAdminStats(): Promise<AdminStats> {
    this.requireAdmin();
    await sleep(netDelay());
    this.lazyCloseAuctions();
    const since = (days: number) => Date.now() - days * 86400_000;
    const byStatus = (s: ListingStatus) => this.listings.filter((l) => l.status === s);
    const sum = (rows: Listing[]) => rows.reduce((n, l) => n + l.price, 0);
    return {
      users: this.profiles.length,
      usersNew7d: this.profiles.filter((p) => new Date(p.createdAt).getTime() > since(7)).length,
      suspended: this.profiles.filter((p) => p.suspendedAt).length,
      admins: this.profiles.filter((p) => p.isAdmin).length,
      listingsActive: byStatus('active').length,
      listingsReserved: byStatus('reserved').length,
      listingsSold: byStatus('sold').length,
      listingsRemoved: byStatus('removed').length,
      listingsNew7d: this.listings.filter((l) => new Date(l.createdAt).getTime() > since(7)).length,
      listingsPending: this.listings.filter(
        (l) => l.reviewState === 'pending' && l.status !== 'removed',
      ).length,
      auctionsLive: this.auctions.filter((a) => a.status === 'live').length,
      bids24h: this.bids.filter((b) => new Date(b.createdAt).getTime() > since(1)).length,
      reportsOpen: this.reports.filter((r) => r.status === 'open').length,
      reportsReviewing: this.reports.filter((r) => r.status === 'reviewing').length,
      reviews: this.reviews.length,
      messages24h: this.messages.filter((m) => new Date(m.createdAt).getTime() > since(1)).length,
      gmvListedActive: sum(byStatus('active')),
      valueSold: sum(byStatus('sold')),
    };
  }

  async adminListUsers(query: string, limit: number): Promise<AdminUser[]> {
    this.requireAdmin();
    await sleep(netDelay());
    const q = query.trim().toLowerCase();
    const cutoff = Date.now() - 90 * 86400_000;
    return this.profiles
      .filter(
        (p) =>
          !q ||
          p.id.toLowerCase().includes(q) ||
          (p.username ?? '').toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((p) => {
        const theirs = this.listings.filter((l) => l.sellerId === p.id);
        return {
          profile: this.withRating(p),
          listingCount: theirs.length,
          activeCount: theirs.filter((l) => l.status === 'active').length,
          soldCount: theirs.filter((l) => l.status === 'sold').length,
          reviewCount: this.reviews.filter((r) => r.revieweeId === p.id).length,
          reportsAgainst: this.reports.filter((r) => this.reportSubject(r)?.ownerId === p.id).length,
          noShowCount: this.noShows.filter(
            (n) =>
              n.reportedId === p.id &&
              n.role === 'winner' &&
              new Date(n.createdAt).getTime() > cutoff,
          ).length,
          bidBanned: this.isBidBanned(p.id),
          warningCount: this.activeWarnings(p.id),
        };
      });
  }

  async adminSetSuspended(userId: string, suspended: boolean, reason: string): Promise<Profile> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    if (userId === actor.id) throw new Error('You cannot suspend your own account.');
    const target = this.profiles.find((p) => p.id === userId);
    if (!target) throw new Error('User not found.');
    if (suspended && reason.trim().length < 3) throw new Error('A suspension reason is required.');
    if (suspended && target.isAdmin) {
      throw new Error('Demote this admin before suspending the account.');
    }
    const was = target.suspendedAt;
    target.suspendedAt = suspended ? new Date().toISOString() : null;
    target.suspendedReason = suspended ? reason.trim() : null;
    this.broadcast({ type: 'profile', profile: structuredClone(target) });
    // As in 0032: the member hears about it either way.
    if (suspended) {
      this.notify(userId, 'moderation', 'Your account is suspended',
        `${reason.trim()}. You can still read, and contact support to appeal.`, '/support');
    } else if (was) {
      this.notify(userId, 'moderation', 'Your suspension was lifted',
        'Your account works normally again.', '/settings');
    }
    this.logAdmin(
      actor,
      suspended ? 'user_suspend' : 'user_unsuspend',
      'user',
      userId,
      reason,
    );
    return structuredClone(this.withRating(target));
  }

  async adminSetAdmin(userId: string, isAdmin: boolean): Promise<Profile> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    if (userId === actor.id && !isAdmin) {
      throw new Error('Another admin has to remove your own admin access.');
    }
    const target = this.profiles.find((p) => p.id === userId);
    if (!target) throw new Error('User not found.');
    if (isAdmin && target.suspendedAt) {
      throw new Error('Lift the suspension before granting admin access.');
    }
    target.isAdmin = isAdmin;
    this.broadcast({ type: 'profile', profile: structuredClone(target) });
    this.logAdmin(actor, isAdmin ? 'user_promote' : 'user_demote', 'user', userId, '');
    return structuredClone(this.withRating(target));
  }

  async adminClearBidBan(userId: string, reason: string): Promise<number> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    const before = this.noShows.length;
    this.noShows = this.noShows.filter(
      (n) => !(n.reportedId === userId && n.role === 'winner'),
    );
    const cleared = before - this.noShows.length;
    this.logAdmin(actor, 'user_clear_bid_ban', 'user', userId, reason, { cleared });
    return cleared;
  }

  async adminSearchListings(
    filter: AdminListingFilter,
    offset: number,
    limit: number,
  ): Promise<ListingPage> {
    this.requireAdmin();
    await sleep(netDelay());
    this.lazyCloseAuctions();
    const q = filter.q.trim().toLowerCase();
    const matches = this.listings
      .filter((l) => filter.status === 'all' || l.status === filter.status)
      .filter((l) => filter.saleType === 'all' || l.saleType === filter.saleType)
      .filter((l) => !filter.sellerId || l.sellerId === filter.sellerId)
      .filter(
        (l) =>
          !q ||
          l.title.toLowerCase().includes(q) ||
          l.setName.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: matches.slice(offset, offset + limit).map((l) => this.hydrate(l)),
      total: matches.length,
      hasMore: offset + limit < matches.length,
    };
  }

  async adminSetListingStatus(
    listingId: string,
    status: ListingStatus,
    reason: string,
  ): Promise<Listing> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Listing not found.');
    if (listing.status === status) return structuredClone(listing);
    if (status === 'removed' && reason.trim().length < 3) {
      throw new Error('A reason is required to remove a listing.');
    }
    const from = listing.status;
    // Moderation deliberately bypasses canTransition — a fraudulent
    // listing comes down even from `sold`.
    const wasStatus = listing.status;
    listing.status = status;
    if (status !== wasStatus && (status === 'removed' || status === 'active')) {
      this.notify(
        listing.sellerId,
        'moderation',
        status === 'removed' ? 'A moderator removed your listing' : 'A moderator restored your listing',
        listing.title,
        `/listing/${listing.id}`,
      );
    }
    listing.reservedForConversationId = null;
    listing.updatedAt = new Date().toISOString();

    const body =
      status === 'removed'
        ? 'A moderator removed this listing.'
        : status === 'active'
          ? 'A moderator restored this listing.'
          : statusChangeSystemMessage(status, false);
    for (const conv of this.conversations.filter((c) => c.listingId === listingId)) {
      const sys: Message = {
        id: nextId('m'),
        conversationId: conv.id,
        senderId: '',
        kind: 'system',
        body,
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
    this.logAdmin(actor, 'listing_status', 'listing', listingId, reason, { from, to: status });
    return structuredClone(listing);
  }

  async adminListReviewQueue(): Promise<ReviewQueueItem[]> {
    this.requireAdmin();
    await sleep(netDelay());
    return this.listings
      .filter((l) => l.reviewState === 'pending' && l.status !== 'removed')
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((l) => {
        const listing = structuredClone(l);
        for (const img of listing.images) img.url = this.resolveImageUrl(img.storagePath);
        return {
          listing,
          seller: this.profileById(l.sellerId),
          screens: structuredClone(this.screens.get(l.id) ?? []),
        };
      });
  }

  async adminReviewListing(listingId: string, approve: boolean, reason: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Listing not found.');
    const from = listing.reviewState;
    if (approve) {
      if (from === 'approved') return;
      listing.reviewState = 'approved';
      listing.reviewNote = null;
      this.notify(listing.sellerId, 'moderation', 'Your listing is live', listing.title,
        `/listing/${listing.id}`, actor.id);
      this.logAdmin(actor, 'listing_approve', 'listing', listing.id, reason, { from });
    } else {
      if (from === 'rejected') return;
      if (reason.trim().length < 3) throw new Error('A reason is required to reject a listing.');
      listing.reviewState = 'rejected';
      listing.reviewNote = reason.trim();
      for (const a of this.auctions) {
        if (a.listingId === listing.id && a.status === 'live') {
          a.status = 'cancelled';
          a.cancelReason = `Listing not approved: ${reason.trim()}`;
        }
      }
      this.notify(listing.sellerId, 'moderation', 'Your listing wasn\'t approved',
        `${listing.title} — ${reason.trim()}`, `/listing/${listing.id}`, actor.id);
      this.logAdmin(actor, 'listing_reject', 'listing', listing.id, reason, { from });
    }
    this.emitListing(listing);
    this.broadcast({ type: 'listing', listing: structuredClone(listing) });
  }

  async adminDeleteListing(listingId: string, reason: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    if (reason.trim().length < 3) throw new Error('A reason is required to delete a listing.');
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Listing not found.');

    // Mirrors the DB's cascade: images live on the row, and conversations,
    // messages, reviews, favorites, auctions and bids all hang off it.
    const convIds = new Set(
      this.conversations.filter((c) => c.listingId === listingId).map((c) => c.id),
    );
    const auctionIds = new Set(
      this.auctions.filter((a) => a.listingId === listingId).map((a) => a.id),
    );
    this.listings = this.listings.filter((l) => l.id !== listingId);
    this.conversations = this.conversations.filter((c) => !convIds.has(c.id));
    this.messages = this.messages.filter((m) => !convIds.has(m.conversationId));
    this.reviews = this.reviews.filter((r) => r.listingId !== listingId);
    this.auctions = this.auctions.filter((a) => a.listingId !== listingId);
    this.bids = this.bids.filter((b) => !auctionIds.has(b.auctionId));
    this.noShows = this.noShows.filter((n) => !auctionIds.has(n.auctionId));
    for (const set of this.favorites.values()) set.delete(listingId);

    this.emitInbox();
    this.logAdmin(actor, 'listing_delete', 'listing', listingId, reason, {
      title: listing.title,
      sellerId: listing.sellerId,
    });
  }

  async adminListAuctions(status: AuctionStatus | 'all'): Promise<AdminAuction[]> {
    this.requireAdmin();
    await sleep(netDelay());
    this.lazyCloseAuctions();
    return this.auctions
      .filter((a) => status === 'all' || a.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => {
        const theirBids = this.bids.filter((b) => b.auctionId === a.id);
        const top = this.topBidOf(a.id);
        return {
          auction: structuredClone(a),
          listingTitle: this.listings.find((l) => l.id === a.listingId)?.title ?? 'Deleted listing',
          seller: this.profileById(a.sellerId),
          bidCount: theirBids.length,
          topBid: top ? top.amount : null,
        };
      });
  }

  async adminCancelAuction(auctionId: string, reason: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    const a = this.auctions.find((x) => x.id === auctionId);
    this.cancelAuctionAs(actor, auctionId, reason, { byModerator: true });
    this.logAdmin(actor, 'auction_cancel', 'auction', auctionId, reason, {
      listingId: a?.listingId ?? null,
    });
  }

  async adminListReviews(query: string, limit: number): Promise<AdminReview[]> {
    this.requireAdmin();
    await sleep(netDelay());
    const q = query.trim().toLowerCase();
    return this.reviews
      .filter((r) => {
        if (!q) return true;
        const reviewee = this.profiles.find((p) => p.id === r.revieweeId);
        return (
          r.body.toLowerCase().includes(q) ||
          (r.reviewer.username ?? '').toLowerCase().includes(q) ||
          (reviewee?.username ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((r) => ({
        ...structuredClone(r),
        reviewee: this.profileById(r.revieweeId),
      }));
  }

  async adminDeleteReview(reviewId: string, reason: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    if (reason.trim().length < 3) throw new Error('A reason is required to delete a review.');
    const review = this.reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error('Review not found.');
    this.reviews = this.reviews.filter((r) => r.id !== reviewId);

    // Re-roll the denormalized rating, blanking it when the last review goes.
    const remaining = this.reviews.filter((r) => r.revieweeId === review.revieweeId);
    const reviewee = this.profiles.find((p) => p.id === review.revieweeId);
    if (reviewee) {
      reviewee.ratingCount = remaining.length;
      reviewee.ratingAvg = remaining.length
        ? remaining.reduce((s, r) => s + r.rating, 0) / remaining.length
        : null;
      this.broadcast({ type: 'profile', profile: structuredClone(reviewee) });
    }
    this.logAdmin(actor, 'review_delete', 'review', reviewId, reason, {
      revieweeId: review.revieweeId,
      rating: review.rating,
    });
  }

  async adminListReports(status: ReportStatus | 'all'): Promise<Report[]> {
    this.requireAdmin();
    await sleep(netDelay());
    return this.reports
      .filter((r) => status === 'all' || r.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => this.toReport(r));
  }

  async adminResolveReport(reportId: string, status: ReportStatus, note: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    const r = this.reports.find((x) => x.id === reportId);
    if (!r) throw new Error('Report not found.');
    const settled = status === 'resolved' || status === 'dismissed';
    r.status = status;
    r.resolutionNote = note.trim() || null;
    r.resolvedBy = settled ? actor.id : null;
    r.resolvedAt = settled ? new Date().toISOString() : null;
    this.broadcast({ type: 'report', report: structuredClone(r) });
    this.logAdmin(actor, 'report_resolve', 'report', reportId, note, { status });
  }

  async adminListActions(limit: number): Promise<AdminAction[]> {
    this.requireAdmin();
    await sleep(netDelay());
    return this.adminActions.slice(0, limit).map((a) => ({
      id: a.id,
      actorId: a.actorId,
      actor: this.profileById(a.actorId),
      kind: a.kind,
      targetType: a.targetType,
      targetId: a.targetId,
      reason: a.reason,
      detail: a.detail,
      createdAt: a.createdAt,
    }));
  }

  // ---- Admin: support -----------------------------------------------------

  async adminListSupportTickets(status: SupportStatus): Promise<SupportTicket[]> {
    this.requireAdmin();
    await sleep(netDelay());
    return this.tickets
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const owe = Number(b.lastFrom === 'user') - Number(a.lastFrom === 'user');
        return owe || b.updatedAt.localeCompare(a.updatedAt);
      })
      .map((t) => this.toTicket(t, true));
  }

  async adminCloseSupportTicket(id: string, note: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    const t = this.tickets.find((x) => x.id === id && x.status === 'open');
    if (!t) throw new Error('No open ticket with that id.');
    if (note.trim()) this.pushTicketMessage(t, actor.id, true, note.trim());
    t.status = 'closed';
    t.lastFrom = 'staff';
    this.pushTicketMessage(t, null, true, `Ticket closed by ${this.handleOf(actor)}.`);
    this.notify(
      t.userId,
      'support',
      `Ticket closed — ${t.subject}`,
      note.trim() || 'If anything is still unresolved, open a new ticket.',
      `/support/${t.id}`,
      actor.id,
      `ticket:${t.id}`,
    );
  }

  // ---- Admin: warnings ----------------------------------------------------

  async adminListWarnings(userId: string): Promise<UserWarning[]> {
    this.requireAdmin();
    await sleep(netDelay());
    return this.warnings
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((w) => this.toWarning(w));
  }

  async adminWarnUser(userId: string, reason: string, listingId?: string | null): Promise<number> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    if (userId === actor.id) throw new Error('You cannot warn your own account.');
    if (reason.trim().length < 3) throw new Error('A reason is required for a warning.');
    const target = this.profiles.find((p) => p.id === userId);
    if (!target) throw new Error('User not found.');
    if (target.isAdmin) throw new Error('Demote this admin before warning the account.');
    const listing = listingId ? this.listings.find((l) => l.id === listingId) : undefined;
    const w: StoredWarning = {
      id: nextId('w'),
      userId,
      issuedBy: actor.id,
      listingId: listing?.id ?? null,
      listingTitle: listing?.title ?? null,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    };
    this.warnings.unshift(w);
    this.broadcast({ type: 'warning', warning: structuredClone(w) });
    const count = this.activeWarnings(userId);
    this.logAdmin(actor, 'user_warn', 'user', userId, reason, {
      warning_id: w.id,
      listing_id: w.listingId,
      warning_count: count,
    });
    this.notify(
      userId,
      'moderation',
      `Warning ${Math.min(count, WARNING_LIMIT)} of ${WARNING_LIMIT}${w.listingTitle ? ` — ${w.listingTitle}` : ''}`,
      `${w.reason}${count >= WARNING_LIMIT ? '' : ` At ${WARNING_LIMIT} warnings the account is suspended.`}`,
      '/settings',
    );
    if (count >= WARNING_LIMIT && !target.suspendedAt) {
      await this.adminSetSuspended(userId, true, `${WARNING_LIMIT} warnings — ${w.reason}`);
    }
    return count;
  }

  async adminRevokeWarning(warningId: string, reason: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    const w = this.warnings.find((x) => x.id === warningId && !x.revokedAt);
    if (!w) throw new Error('No active warning with that id.');
    w.revokedAt = new Date().toISOString();
    w.revokedBy = actor.id;
    w.revokeReason = reason.trim() || null;
    this.broadcast({ type: 'warning', warning: structuredClone(w) });
    this.logAdmin(actor, 'warning_revoke', 'user', w.userId, reason, { warning_id: w.id });
    this.notify(w.userId, 'moderation', 'A warning was withdrawn', reason.trim(), '/settings');
  }

  // ---- Admin: billing ----------------------------------------------------

  async adminListPurchases(status: PurchaseStatus): Promise<PurchaseRequest[]> {
    this.requireAdmin();
    await sleep(netDelay());
    const named = (userId: string) => {
      const prof = this.profiles.find((pr) => pr.id === userId);
      return {
        username: prof?.username ?? '',
        displayName: prof?.displayName ?? 'Someone',
      };
    };
    const priceOf = (code: string | null) =>
      code ? (this.plans.find((pl) => pl.code === code)?.priceUsd ?? null) : null;
    const rows: PurchaseRequest[] = [
      ...this.subscriptions
        .filter((sub) => sub.status === status)
        .map((sub) => ({
          kind: 'subscription' as PurchaseKind,
          id: sub.id,
          userId: sub.userId,
          ...named(sub.userId),
          planCode: sub.planCode,
          credits: null,
          priceUsd: priceOf(sub.planCode),
          status: sub.status,
          note: sub.note,
          createdAt: sub.createdAt,
        })),
      ...this.creditPacks
        .filter((pk) => pk.status === status)
        .map((pk) => ({
          kind: 'credits' as PurchaseKind,
          id: pk.id,
          userId: pk.userId,
          ...named(pk.userId),
          planCode: pk.planCode,
          credits: pk.credits,
          priceUsd: priceOf(pk.planCode),
          status: pk.status,
          note: pk.note,
          createdAt: pk.createdAt,
        })),
    ];
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async adminReviewPurchase(
    kind: PurchaseKind,
    id: string,
    approve: boolean,
    reason: string,
  ): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    if (kind === 'subscription') {
      const req = this.subscriptions.find((sub) => sub.id === id && sub.status === 'pending');
      if (!req) throw new Error('No pending subscription request with that id.');
      if (approve) {
        this.activateSubscription(req.userId, req.planCode, reason);
      } else {
        req.status = 'rejected';
      }
    } else {
      const pack = this.creditPacks.find((pk) => pk.id === id && pk.status === 'pending');
      if (!pack) throw new Error('No pending credit request with that id.');
      pack.status = approve ? 'active' : 'rejected';
    }
    this.logAdmin(
      actor,
      'report_resolve',
      'user',
      kind === 'subscription'
        ? (this.subscriptions.find((sub) => sub.id === id)?.userId ?? id)
        : (this.creditPacks.find((pk) => pk.id === id)?.userId ?? id),
      `${approve ? 'Approved' : 'Rejected'} ${kind} purchase${reason ? ` — ${reason}` : ''}`,
    );
    this.broadcastBilling();
  }

  /** Shared by the request-approval path and the direct admin action. */
  private activateSubscription(userId: string, planCode: string, note: string): void {
    const plan = this.plans.find((pl) => pl.code === planCode && pl.kind === 'subscription');
    if (!plan) throw new Error('Unknown subscription plan.');
    for (const sub of this.subscriptions) {
      if (sub.userId === userId && (sub.status === 'active' || sub.status === 'pending')) {
        sub.status = 'cancelled';
      }
    }
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + (plan.periodMonths ?? 1));
    this.subscriptions.push({
      id: nextId('sub'),
      userId,
      planCode: plan.code,
      tier: plan.tier ?? 'monthly',
      status: 'active',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      note,
      createdAt: start.toISOString(),
    });
  }

  async adminActivateSubscription(
    userId: string,
    planCode: string,
    reason: string,
  ): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    this.activateSubscription(userId, planCode, reason);
    this.logAdmin(actor, 'user_promote', 'user', userId, `Subscription activated: ${planCode}`);
    this.broadcastBilling();
  }

  async adminEndSubscription(userId: string, reason: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    for (const sub of this.subscriptions) {
      if (sub.userId === userId && (sub.status === 'active' || sub.status === 'pending')) {
        sub.status = 'cancelled';
      }
    }
    this.logAdmin(actor, 'user_demote', 'user', userId, `Subscription ended${reason ? ` — ${reason}` : ''}`);
    this.broadcastBilling();
  }

  async adminGrantCredits(userId: string, credits: number, reason: string): Promise<void> {
    const actor = this.requireAdmin();
    await sleep(netDelay());
    if (!(credits > 0)) throw new Error('Credits must be positive.');
    this.creditPacks.push({
      id: nextId('pack'),
      userId,
      planCode: null,
      credits,
      used: 0,
      status: 'active',
      note: reason,
      createdAt: new Date().toISOString(),
    });
    this.logAdmin(actor, 'user_promote', 'user', userId, `${credits} listing credits granted`);
    this.broadcastBilling();
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

/** A report as the mock world stores it — the DB row, not the user's input. */
interface StoredReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportInput['reason'];
  detail: string;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

/** One audit row (mirrors public.admin_actions). */
interface StoredAdminAction {
  id: string;
  actorId: string;
  kind: AdminActionKind;
  targetType: string;
  targetId: string;
  reason: string;
  detail: Record<string, unknown>;
  createdAt: string;
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
  reports: StoredReport[];
  adminActions?: StoredAdminAction[];
  notifications?: StoredNotification[];
  warnings?: StoredWarning[];
  tickets?: StoredTicket[];
  supportMessages?: StoredSupportMessage[];
  subscriptions?: MockSubscription[];
  creditPacks?: MockCreditPack[];
  listingCounts?: Array<[string, number]>;
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
  | { type: 'report'; report: StoredReport }
  | { type: 'adminaction'; action: StoredAdminAction }
  | { type: 'profile'; profile: Profile }
  | { type: 'credential'; email: string; userId: string; password: string | null }
  | { type: 'auction'; auction: Auction }
  | { type: 'bid'; bid: Bid }
  | { type: 'presence'; auctionId: string; tabId: string; at: number; leaving?: boolean }
  | { type: 'online'; userId: string; tabId: string; at: number; leaving?: boolean }
  | { type: 'noshow-retract'; auctionId: string; reporterId: string }
  | { type: 'notification'; notification: StoredNotification }
  | { type: 'warning'; warning: StoredWarning }
  | { type: 'ticket'; ticket: StoredTicket; message?: StoredSupportMessage }
  | { type: 'notifications-read'; userId: string; ids: string[] | null; at: string }
  | {
      type: 'billing';
      subscriptions: MockSubscription[];
      creditPacks: MockCreditPack[];
      listingCounts: Array<[string, number]>;
    }
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
