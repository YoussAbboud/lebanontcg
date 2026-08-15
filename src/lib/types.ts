// Domain types shared by both MarketplaceClient implementations.

export type Game = 'pokemon' | 'magic' | 'yugioh' | 'onepiece' | 'lorcana' | 'other';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type Finish = 'normal' | 'holo' | 'reverse' | 'foil' | 'etched' | 'other';
export type ListingStatus = 'active' | 'reserved' | 'sold' | 'removed';
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
  reservedForConversationId: string | null;
  createdAt: string;
  updatedAt: string;
  images: ListingImage[];
}

/** Listing plus its seller, as needed by cards and the detail page. */
export interface ListingWithSeller extends Listing {
  seller: Profile;
  sellerActiveListingCount: number;
  /** How many collectors watch (favorite) this listing. */
  likes: number;
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
  language: string | null;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'most_watched';
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
