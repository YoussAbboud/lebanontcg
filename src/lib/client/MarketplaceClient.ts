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
  SellerStats,
} from '../types';

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

  // ---- Storage -----------------------------------------------------------
  /** Resolve a storage path to a displayable URL. */
  resolveImageUrl(storagePath: string): string;
}
