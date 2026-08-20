import type {
  AdminAction,
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
  Report,
  ReportInput,
  ReportStatus,
  Review,
  SellerStats,
} from '../types';
import type {
  DefectAssessment,
  PregradeReport,
  PregradeReportInput,
} from '../pregrade/types';

export type Unsubscribe = () => void;

export interface AuthState {
  /** Signed-in user's profile, or null. */
  user: Profile | null;
  /** True while the initial session restore is running. */
  loading: boolean;
  /**
   * True for accounts that have no password yet — the magic-link-era
   * users. The app prompts them to set one before letting them continue.
   */
  needsPassword: boolean;
}

export interface SignUpResult {
  /** True when a confirmation email was sent and there's no session yet. */
  needsEmailConfirmation: boolean;
}

export interface AuctionEvent {
  /** 'bid' = a new bid landed (payload attached); 'updated' = the
      auction row changed (extension, close, cancel) — refetch-friendly. */
  type: 'bid' | 'updated';
  auction: Auction;
  bid?: Bid;
}

export interface PlacedBid {
  amount: number;
  endsAt: string;
  /** The bid landed in the final minute and pushed the close out 60s. */
  extended: boolean;
}

export interface ConversationEvent {
  /** 'refresh' = message rows changed in place (read receipts, offer
      status) — refetch; 'typing' = the other party is composing. */
  type: 'message' | 'refresh' | 'listing_updated' | 'typing';
  conversationId: string;
  message?: Message;
  listing?: Listing;
}

/**
 * Abstracts ALL data access (auth, listings, chat, storage) so the app can
 * run against Supabase or a fully offline in-memory mock (VITE_MOCK=1).
 * UI code never imports Supabase directly.
 */
export interface MarketplaceClient {
  readonly isMock: boolean;

  // ---- Auth --------------------------------------------------------------
  getAuthState(): AuthState;
  onAuthChange(cb: (state: AuthState) => void): Unsubscribe;
  /** Create an account. The address must be confirmed by email before the
      password works, so this usually resolves with needsEmailConfirmation. */
  signUpWithPassword(email: string, password: string): Promise<SignUpResult>;
  /** Everyday sign-in for confirmed accounts. */
  signInWithPassword(email: string, password: string): Promise<void>;
  /** Sends a magic link — account recovery and the path for accounts that
      predate passwords. */
  signInWithEmail(email: string): Promise<void>;
  /** Set (or replace) the signed-in user's password. Clears needsPassword. */
  setPassword(password: string): Promise<void>;
  /** Sends a password-reset email. */
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Mock-mode only: seeded users for the dev switcher. */
  listMockUsers(): Promise<Profile[]>;
  /** Mock-mode only: instant sign-in as a seeded user. */
  signInAsMockUser(userId: string): Promise<void>;
  /** Claim a username (immutable once set). Rejects if taken. */
  claimUsername(username: string): Promise<Profile>;
  updateProfile(patch: { displayName?: string; bio?: string; avatarUrl?: string | null }): Promise<Profile>;
  /** Store a (client-compressed) avatar image; returns the value to save
      as profile.avatarUrl (resolve for display via resolveImageUrl). */
  uploadAvatar(image: Blob): Promise<string>;

  // ---- Profiles ----------------------------------------------------------
  getProfileByUsername(username: string): Promise<Profile | null>;
  getProfile(id: string): Promise<Profile | null>;
  /** Sellers ranked by reviews + activity (Sellers pages). */
  listSellers(limit: number): Promise<SellerStats[]>;
  getSellerStats(userId: string): Promise<SellerStats | null>;

  // ---- Listings (read) ---------------------------------------------------
  searchListings(filter: ListingFilter, offset: number, limit: number): Promise<ListingPage>;
  getListing(id: string): Promise<ListingWithSeller | null>;
  getListingsBySeller(sellerId: string, statuses: ListingStatus[]): Promise<Listing[]>;
  /** Live updates to one listing (status/price changes). */
  subscribeToListing(id: string, cb: (listing: Listing) => void): Unsubscribe;

  // ---- Listings (write) --------------------------------------------------
  createListing(input: ListingInput, images: ImageDraft[]): Promise<Listing>;
  updateListing(id: string, input: ListingInput, images: ImageDraft[]): Promise<Listing>;
  setListingStatus(
    id: string,
    status: ListingStatus,
    opts?: { reservedForConversationId?: string | null },
  ): Promise<Listing>;

  // ---- Auctions ----------------------------------------------------------
  /** Create an auction-type listing (listing + auction in one
      transaction — the pairing is enforced at the DB). */
  createAuctionListing(
    input: ListingInput,
    images: ImageDraft[],
    auction: AuctionInput,
  ): Promise<Listing>;
  /** The auction + full bid history for a listing (newest first).
      Lazily closes overdue auctions so a stale one never reads live. */
  getAuctionForListing(listingId: string): Promise<AuctionDetail | null>;
  /**
   * Place a bid. ALL validation happens server-side (place_bid in
   * Postgres / the mock engine): live status, not the seller, blocks,
   * minimum increment, anti-snipe. Rejections throw with the reason
   * (e.g. the new minimum) — never a silent failure.
   */
  placeBid(auctionId: string, amount: number): Promise<PlacedBid>;
  /** Live events for one auction: new bids and auction-row changes. */
  subscribeToAuction(auctionId: string, cb: (ev: AuctionEvent) => void): Unsubscribe;
  /**
   * Live viewer count for one auction. `join: true` marks this tab as a
   * viewer (use it on the auction's page); observers — home cards,
   * dashboards — subscribe without joining and don't inflate the count.
   */
  subscribeToAuctionPresence(
    auctionId: string,
    cb: (count: number) => void,
    opts?: { join?: boolean },
  ): Unsubscribe;
  /** Seller only: close now — the highest bid (if any) wins as-is. */
  endAuctionEarly(auctionId: string): Promise<void>;
  /** Seller only: no winner, reason required, every bidder notified. */
  cancelAuction(auctionId: string, reason: string): Promise<void>;
  /**
   * After a closed auction: the seller marks the winner a no-show, or
   * the winner mirrors it for an unresponsive seller. Only once the
   * grace period has passed (24h from the close — nobody fails to
   * follow through in an hour). Three winner no-shows in 90 days block
   * bidding (listings and chat unaffected); reports feed the queue.
   */
  reportAuctionNoShow(auctionId: string): Promise<void>;
  /** Undo your own no-show report — the strike and its queue entry both
      go, so a misfiled accusation leaves no trace. */
  retractAuctionNoShow(auctionId: string): Promise<void>;
  /** Winner-role no-shows recorded against a user in the last 90 days. */
  getAuctionNoShowCount(userId: string): Promise<number>;
  /** Every auction this seller has run — live and finished. Powers the
      profile's Live Bids section (auctions never sit in Listings). */
  getAuctionsBySeller(sellerId: string): Promise<Auction[]>;

  // ---- Favorites ---------------------------------------------------------
  getFavoriteIds(): Promise<Set<string>>;
  getFavoriteListings(): Promise<ListingWithSeller[]>;
  setFavorite(listingId: string, favorited: boolean): Promise<void>;

  // ---- Chat --------------------------------------------------------------
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationSummary | null>;
  /** Opens (or returns the existing) conversation for a listing as buyer. */
  openConversation(listingId: string): Promise<Conversation>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, body: string, clientId: string): Promise<Message>;
  /** Non-binding offer: an 'offer'-kind message with an amount. */
  sendOffer(conversationId: string, amount: number, note: string, clientId: string): Promise<Message>;
  /** Recipient accepts/declines a proposed offer. */
  respondToOffer(conversationId: string, messageId: string, accept: boolean): Promise<void>;
  /** Fire-and-forget "I'm typing" signal to the other party. */
  sendTyping(conversationId: string): void;
  markConversationRead(conversationId: string): Promise<void>;
  /** Events for one open thread: new messages, read receipts, listing updates. */
  subscribeToConversation(conversationId: string, cb: (ev: ConversationEvent) => void): Unsubscribe;
  /** Coarse "something changed in some conversation" signal for list/badges. */
  subscribeToInbox(cb: () => void): Unsubscribe;
  getTotalUnreadCount(): Promise<number>;

  // ---- Trust -------------------------------------------------------------
  getReviewsForUser(userId: string): Promise<Review[]>;
  /** All reviews on one conversation (0 or 1 today: the buyer's). Drives
      the in-chat prompt with a single, join-free query. */
  getConversationReviews(conversationId: string): Promise<Review[]>;
  /** Reviews the signed-in user has written (the /reviews hub). */
  getReviewsWritten(): Promise<Review[]>;
  getPendingReviews(): Promise<PendingReview[]>;
  submitReview(conversationId: string, rating: number, body: string): Promise<Review>;
  submitReport(input: ReportInput): Promise<void>;
  getBlockedIds(): Promise<Set<string>>;
  setBlocked(userId: string, blocked: boolean): Promise<void>;

  // ---- Pre-grade ----------------------------------------------------------
  /**
   * Run the defect assessment over prepared capture images. Mock mode
   * returns canned cases (selected by caseHint); live posts to the
   * serverless rubric endpoint, which validates, retries once, then
   * abstains — never guesses.
   */
  assessPregrade(input: {
    images: { slot: string; blob: Blob }[];
    hasRake: boolean;
    caseHint?: string;
  }): Promise<DefectAssessment>;
  /** Persist a finished report (captures go to the private store). */
  savePregradeReport(input: PregradeReportInput): Promise<PregradeReport>;
  listMyPregradeReports(): Promise<PregradeReport[]>;
  /** Own report, or anyone's when published. */
  getPregradeReport(id: string): Promise<PregradeReport | null>;
  getPublishedPregradeReport(listingId: string): Promise<PregradeReport | null>;
  /**
   * Attach + publish to one of the OWNER'S listings. Runs the
   * perceptual-hash gate: the report's front capture must look like the
   * listing's cover, or this throws with the mismatch copy.
   */
  publishPregradeReport(reportId: string, listingId: string): Promise<PregradeReport>;
  unpublishPregradeReport(reportId: string): Promise<PregradeReport>;
  /** "It came back as a…" — the calibration loop's raw material. */
  recordPregradeOutcome(reportId: string, actualGrade: number, certNumber?: string): Promise<void>;

  // ---- Admin --------------------------------------------------------------
  /**
   * Every method below is admin-only and enforced SERVER-side (the
   * security-definer RPCs in 0016 assert the caller's is_admin and write
   * an audit row). The client-side route guard is convenience, not
   * security — a non-admin calling these gets a rejection, not data.
   */
  getAdminStats(): Promise<AdminStats>;
  /** Accounts with their moderation-relevant counts. `query` matches
      handle, display name or id; empty returns the newest accounts. */
  adminListUsers(query: string, limit: number): Promise<AdminUser[]>;
  /** Suspend (reason required) or lift. Returns the updated profile. */
  adminSetSuspended(userId: string, suspended: boolean, reason: string): Promise<Profile>;
  /** Grant or revoke console access. Nobody can revoke their own. */
  adminSetAdmin(userId: string, isAdmin: boolean): Promise<Profile>;
  /** Clear the winner-role no-shows behind a bidding block; returns how
      many were cleared. For when a no-show report was retaliation. */
  adminClearBidBan(userId: string, reason: string): Promise<number>;
  /** Listings unfiltered by visibility — removed rows included. */
  adminSearchListings(
    filter: AdminListingFilter,
    offset: number,
    limit: number,
  ): Promise<ListingPage>;
  /** Force a status, bypassing the seller-facing transition rules (a
      fraudulent listing has to come down even from `sold`). */
  adminSetListingStatus(listingId: string, status: ListingStatus, reason: string): Promise<Listing>;
  /** Hard delete — cascades to images, conversations and reviews. Last
      resort; removal is the everyday tool. */
  adminDeleteListing(listingId: string, reason: string): Promise<void>;
  adminListAuctions(status: AuctionStatus | 'all'): Promise<AdminAuction[]>;
  /** Kill a live auction: no winner, every bidder told a moderator did it. */
  adminCancelAuction(auctionId: string, reason: string): Promise<void>;
  adminListReviews(query: string, limit: number): Promise<AdminReview[]>;
  /** Delete a review and re-roll the reviewee's denormalized rating. */
  adminDeleteReview(reviewId: string, reason: string): Promise<void>;
  /** The moderation queue, resolved subjects attached. */
  adminListReports(status: ReportStatus | 'all'): Promise<Report[]>;
  adminResolveReport(reportId: string, status: ReportStatus, note: string): Promise<void>;
  /** The append-only audit log, newest first. */
  adminListActions(limit: number): Promise<AdminAction[]>;

  // ---- Storage -----------------------------------------------------------
  /** Resolve a storage path to a displayable URL. */
  resolveImageUrl(storagePath: string): string;
}
