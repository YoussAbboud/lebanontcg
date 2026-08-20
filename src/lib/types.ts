// Domain types shared by both MarketplaceClient implementations.

export type Game = 'pokemon' | 'magic' | 'yugioh' | 'onepiece' | 'lorcana' | 'other';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type Finish = 'normal' | 'holo' | 'reverse' | 'foil' | 'etched' | 'other';
export type ListingStatus = 'active' | 'reserved' | 'sold' | 'removed';
/** Chosen once at creation, immutable for the life of the listing. */
export type SaleType = 'fixed' | 'auction';
export type AuctionStatus = 'live' | 'closed' | 'cancelled';
export type ReportTargetType = 'listing' | 'user' | 'message';
export type ReportReason =
  | 'scam'
  | 'counterfeit'
  | 'inappropriate'
  | 'spam'
  | 'harassment'
  | 'other';

export const GAMES: Game[] = ['pokemon', 'magic', 'yugioh', 'onepiece', 'lorcana', 'other'];
export const GAME_LABELS: Record<Game, string> = {
  pokemon: 'Pokémon',
  magic: 'Magic: The Gathering',
  yugioh: 'Yu-Gi-Oh!',
  onepiece: 'One Piece',
  lorcana: 'Lorcana',
  other: 'Other',
};

export const CONDITIONS: Condition[] = ['NM', 'LP', 'MP', 'HP', 'DMG'];
export const CONDITION_LABELS: Record<Condition, string> = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
};

export const FINISHES: Finish[] = ['normal', 'holo', 'reverse', 'foil', 'etched', 'other'];
export const FINISH_LABELS: Record<Finish, string> = {
  normal: 'Normal',
  holo: 'Holo',
  reverse: 'Reverse Holo',
  foil: 'Foil',
  etched: 'Etched',
  other: 'Other',
};

export const REPORT_REASONS: ReportReason[] = [
  'scam',
  'counterfeit',
  'inappropriate',
  'spam',
  'harassment',
  'other',
];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  scam: 'Scam or fraud',
  counterfeit: 'Counterfeit card',
  inappropriate: 'Inappropriate content',
  spam: 'Spam',
  harassment: 'Harassment',
  other: 'Something else',
};

export interface Profile {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  createdAt: string;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface ListingImage {
  id: string;
  listingId: string;
  storagePath: string;
  url: string;
  sortOrder: number;
}

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  game: Game;
  setName: string;
  cardNumber: string;
  language: string;
  condition: Condition;
  finish: Finish;
  gradeCompany: string | null;
  gradeValue: string | null;
  price: number;
  currency: string;
  quantity: number;
  description: string;
  status: ListingStatus;
  saleType: SaleType;
  reservedForConversationId: string | null;
  createdAt: string;
  updatedAt: string;
  images: ListingImage[];
}

/** A live auction attached to exactly one auction-type listing. Bids
    are public, non-binding signals — no money moves on the platform. */
export interface Auction {
  id: string;
  listingId: string;
  sellerId: string;
  startingPrice: number;
  reservePrice: number | null;
  currency: string;
  endsAt: string;
  status: AuctionStatus;
  winnerId: string | null;
  winningBid: number | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  /** Display handle resolved at fetch time ("@maya" or a display name). */
  bidderName: string;
  amount: number;
  /** This bid landed in the final minute and pushed the close out 60s. */
  extended: boolean;
  createdAt: string;
}

export interface AuctionDetail {
  auction: Auction;
  /** Newest first. */
  bids: Bid[];
  /** Who won, for the outcome line — null while live or unsold. */
  winner?: { id: string; username: string | null; displayName: string } | null;
  /** The signed-in user already filed their no-show report here. */
  myNoShowReported?: boolean;
}

/** Auction parameters chosen at listing creation. */
export interface AuctionInput {
  startingPrice: number;
  /** "If bidding doesn't reach this, nobody wins" — optional. */
  reservePrice: number | null;
  durationHours: number;
}

export const AUCTION_DURATIONS: Array<{ hours: number; label: string }> = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
];

/** Listing plus its seller, as needed by cards and the detail page. */
export interface ListingWithSeller extends Listing {
  seller: Profile;
  sellerActiveListingCount: number;
  /** How many collectors watch (favorite) this listing. */
  likes: number;
  /** Present on auction-type listings so cards can show the live pill,
      countdown and current bid. */
  auction?: Auction | null;
  /** Published pre-grade pill, e.g. "EST. 9–10" — null when none.
      Deliberately subordinate to a real slab badge. */
  pregradePill?: string | null;
}

export interface ListingFilter {
  q: string;
  games: Game[];
  conditions: Condition[];
  finishes: Finish[];
  priceMin: number | null;
  priceMax: number | null;
  gradedOnly: boolean;
  /** Only listings whose seller has at least one review. */
  sellerHasReviews: boolean;
  /** Only listings carrying a published pre-grade report. Filtering or
      sorting by ESTIMATED GRADE is deliberately impossible — that would
      turn an estimate into a de-facto grade. */
  hasPregrade?: boolean;
  language: string | null;
  /** All listings, buy-now only, or live auctions only. */
  saleType?: 'all' | 'fixed' | 'auction';
  /** ending_soon applies to auctions only. */
  sort: 'newest' | 'price_asc' | 'price_desc' | 'most_watched' | 'ending_soon';
}

export interface ListingPage {
  items: ListingWithSeller[];
  total: number;
  hasMore: boolean;
}

export interface ListingInput {
  title: string;
  game: Game;
  setName: string;
  cardNumber: string;
  language: string;
  condition: Condition;
  finish: Finish;
  gradeCompany: string | null;
  gradeValue: string | null;
  price: number;
  currency: string;
  quantity: number;
  description: string;
}

/** An image staged for upload (new) or already stored (existing). */
export interface ImageDraft {
  id: string;
  kind: 'existing' | 'new';
  /** Preview URL — object URL for new files, storage URL for existing. */
  url: string;
  /** Present for kind=new. Already compressed client-side. */
  file?: Blob;
}

export interface Conversation {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface ConversationSummary extends Conversation {
  listing: Listing;
  otherParty: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

export type OfferStatus = 'proposed' | 'accepted' | 'declined';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  /** Empty senderId + kind=system for status-change notices. */
  kind: 'user' | 'system' | 'offer';
  body: string;
  /** kind=offer only: proposed amount in the listing's currency. */
  amount: number | null;
  /** kind=offer only: negotiation state, mutated by the recipient. */
  offerStatus: OfferStatus | null;
  createdAt: string;
  readAt: string | null;
  /** Client-side only: set while an optimistic send is in flight. */
  pending?: boolean;
  /** Client id used to reconcile optimistic sends. */
  clientId?: string;
}

export interface Review {
  id: string;
  conversationId: string;
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  body: string;
  createdAt: string;
  reviewer: Profile;
}

/** A sold conversation the current user hasn't reviewed yet. */
export interface PendingReview {
  conversationId: string;
  listing: Listing;
  otherParty: Profile;
}

export interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string;
}

export const MESSAGE_MAX_LENGTH = 2000;
export const MAX_LISTING_IMAGES = 8;

/** A seller with marketplace stats, as ranked on the Sellers pages. */
export interface SellerStats {
  profile: Profile;
  /** 1-based rank position ("01" formatting is a UI concern). */
  rank: number;
  activeCount: number;
  soldCount: number;
  /** Games this seller currently lists, most frequent first. */
  games: Game[];
}
