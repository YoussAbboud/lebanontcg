import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Auction,
  AuctionDetail,
  AuctionInput,
  AuctionStatus,
  Bid,
  Condition,
  Conversation,
  ConversationSummary,
  Finish,
  Game,
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
import type {
  AxisRatio,
  CaptureSlot,
  DefectAssessment,
  PregradeReport,
  PregradeReportInput,
} from '../pregrade/types';
import { pregradePillLabel } from '../pregrade/copy';
import { CURRENT_STANDARD } from '../pregrade/standards';
import { PHASH_MISMATCH_COPY } from '../pregrade/phash';
import { capturesMatchCover } from '../pregrade/phashGate';
import { toStorageImage } from '../pregrade/decode';
import type {
  AuctionEvent,
  AuthState,
  ConversationEvent,
  MarketplaceClient,
  PlacedBid,
  SignUpResult,
  Unsubscribe,
} from './MarketplaceClient';

// ---------------------------------------------------------------------------
// Row → domain mapping (DB is snake_case; the app is camelCase)
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  rating_avg: number | string | null;
  rating_count: number;
  created_at: string;
}

interface ListingImageRow {
  id: string;
  listing_id: string;
  storage_path: string;
  sort_order: number;
}

interface ListingRow {
  id: string;
  seller_id: string;
  title: string;
  game: Game;
  set_name: string;
  card_number: string;
  language: string;
  condition: Condition;
  finish: Finish;
  grade_company: string | null;
  grade_value: string | null;
  price: number | string;
  currency: string;
  quantity: number;
  description: string;
  status: ListingStatus;
  sale_type: 'fixed' | 'auction';
  reserved_for_conversation_id: string | null;
  created_at: string;
  updated_at: string;
  listing_images?: ListingImageRow[];
  auctions?: AuctionRow[];
}

interface AuctionRow {
  id: string;
  listing_id: string;
  seller_id: string;
  starting_price: number | string;
  reserve_price: number | string | null;
  currency: string;
  ends_at: string;
  status: AuctionStatus;
  winner_id: string | null;
  winning_bid: number | string | null;
  cancel_reason: string | null;
  created_at: string;
}

interface BidRow {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number | string;
  extended: boolean;
  created_at: string;
  bidder?: { username: string | null; display_name: string } | null;
}

interface ConversationRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  last_message_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: 'user' | 'system' | 'offer';
  body: string;
  amount: number | string | null;
  offer_status: 'proposed' | 'accepted' | 'declined' | null;
  created_at: string;
  read_at: string | null;
}

interface ReviewRow {
  id: string;
  conversation_id: string;
  listing_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  body: string;
  created_at: string;
  reviewer?: ProfileRow;
}

interface PregradeCaptureRow {
  id: string;
  report_id: string;
  slot: CaptureSlot;
  path: string;
}

interface PregradeOutcomeRow {
  actual_grade: number;
  cert_number: string | null;
  reported_at: string;
}

interface PregradeRow {
  id: string;
  user_id: string;
  listing_id: string | null;
  published: boolean;
  standards_version: string;
  era: PregradeReport['era'];
  centering_method: PregradeReport['centeringMethod'];
  front_lr: number | string;
  front_tb: number | string;
  back_lr: number | string | null;
  back_tb: number | string | null;
  score_centering: number | null;
  score_corners: number | null;
  score_edges: number | null;
  score_surface: number | null;
  base_grade: number;
  is_ceiling: boolean;
  p10: number | string;
  p9: number | string;
  p8: number | string;
  p_low: number | string;
  confidence: PregradeReport['confidence'];
  recommendation: PregradeReport['recommendation'];
  findings: unknown;
  notes: unknown;
  diagram: unknown;
  model_id: string | null;
  created_at: string;
  pregrade_captures?: PregradeCaptureRow[];
  pregrade_outcomes?: PregradeOutcomeRow[];
}

const LISTING_SELECT = '*, listing_images(*), auctions(*)';

export class SupabaseMarketplaceClient implements MarketplaceClient {
  readonly isMock = false;
  private sb: SupabaseClient;
  private auth: AuthState = { user: null, loading: true, needsPassword: false };
  private authListeners = new Set<(s: AuthState) => void>();
  /** Open realtime channels per conversation (used for typing broadcast). */
  private convChannels = new Map<string, ReturnType<SupabaseClient['channel']>>();

  constructor(url: string, anonKey: string) {
    this.sb = createSupabase(url, anonKey);
    // Restore session, then track changes.
    void this.refreshAuthProfile();
    this.sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void this.refreshAuthProfile();
      }
    });
  }

  // ---- mapping helpers ----------------------------------------------------

  private mapProfile(row: ProfileRow): Profile {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      createdAt: row.created_at,
      ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
      ratingCount: row.rating_count,
    };
  }

  private mapListing(row: ListingRow): Listing {
    const images = (row.listing_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        id: img.id,
        listingId: img.listing_id,
        storagePath: img.storage_path,
        url: this.resolveImageUrl(img.storage_path),
        sortOrder: img.sort_order,
      }));
    return {
      id: row.id,
      sellerId: row.seller_id,
      title: row.title,
      game: row.game,
      setName: row.set_name,
      cardNumber: row.card_number,
      language: row.language,
      condition: row.condition,
      finish: row.finish,
      gradeCompany: row.grade_company,
      gradeValue: row.grade_value,
      price: Number(row.price),
      currency: row.currency,
      quantity: row.quantity,
      description: row.description,
      status: row.status,
      saleType: row.sale_type ?? 'fixed',
      reservedForConversationId: row.reserved_for_conversation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      images,
    };
  }

  private mapAuction(row: AuctionRow): Auction {
    return {
      id: row.id,
      listingId: row.listing_id,
      sellerId: row.seller_id,
      startingPrice: Number(row.starting_price),
      reservePrice: row.reserve_price === null ? null : Number(row.reserve_price),
      currency: row.currency,
      endsAt: row.ends_at,
      status: row.status,
      winnerId: row.winner_id,
      winningBid: row.winning_bid === null ? null : Number(row.winning_bid),
      cancelReason: row.cancel_reason,
      createdAt: row.created_at,
    };
  }

  private mapBid(row: BidRow): Bid {
    return {
      id: row.id,
      auctionId: row.auction_id,
      bidderId: row.bidder_id,
      bidderName: row.bidder
        ? row.bidder.username
          ? `@${row.bidder.username}`
          : row.bidder.display_name
        : 'a collector',
      amount: Number(row.amount),
      extended: row.extended,
      createdAt: row.created_at,
    };
  }

  /** The embedded auction of an auction-type row (undefined for fixed). */
  private auctionOf(row: ListingRow): Auction | null | undefined {
    if (row.sale_type !== 'auction') return undefined;
    const a = row.auctions?.[0];
    return a ? this.mapAuction(a) : null;
  }

  private mapMessage(row: MessageRow): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id ?? '',
      kind: row.kind,
      body: row.body,
      amount: row.amount === null ? null : Number(row.amount),
      offerStatus: row.offer_status,
      createdAt: row.created_at,
      readAt: row.read_at,
    };
  }

  private mapReview(row: ReviewRow): Review {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      listingId: row.listing_id,
      reviewerId: row.reviewer_id,
      revieweeId: row.reviewee_id,
      rating: row.rating,
      body: row.body,
      createdAt: row.created_at,
      reviewer: row.reviewer
        ? this.mapProfile(row.reviewer)
        : {
            id: row.reviewer_id,
            username: null,
            displayName: 'Collector',
            avatarUrl: null,
            bio: '',
            createdAt: row.created_at,
            ratingAvg: null,
            ratingCount: 0,
          },
    };
  }

  private uid(): string {
    if (!this.auth.user) throw new Error('Not signed in');
    return this.auth.user.id;
  }

  private async refreshAuthProfile(): Promise<void> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) {
      this.setAuth({ user: null, loading: false, needsPassword: false });
      return;
    }
    // Accounts created by magic link have no password. The flag is written
    // at sign-up / set-password time; treating "absent" as "needs one"
    // means every pre-password account gets prompted exactly once.
    const needsPassword = data.user.user_metadata?.has_password !== true;
    let { data: row } = await this.sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!row) {
      // Accounts created before the schema was applied have no profile row
      // (the auth trigger didn't exist yet) — self-heal it.
      const { data: created } = await this.sb
        .from('profiles')
        .insert({
          id: data.user.id,
          display_name: data.user.email?.split('@')[0] ?? 'collector',
        })
        .select()
        .maybeSingle();
      row = created ?? null;
    }
    this.setAuth({
      user: row ? this.mapProfile(row as ProfileRow) : null,
      loading: false,
      needsPassword,
    });
  }

  private setAuth(state: AuthState) {
    this.auth = state;
    for (const cb of this.authListeners) cb(state);
  }

  /** Replace the profile while keeping the auth flags intact. */
  private setUser(profile: Profile) {
    this.setAuth({ ...this.auth, user: profile, loading: false });
  }

  // ---- Auth ---------------------------------------------------------------

  getAuthState(): AuthState {
    return this.auth;
  }

  onAuthChange(cb: (state: AuthState) => void): Unsubscribe {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }

  async signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.sb.auth.signUp({
      email,
      password,
      // has_password is the flag the set-password gate reads; it rides in
      // user metadata so no extra table round-trip is needed at sign-in.
      options: { emailRedirectTo: window.location.origin, data: { has_password: true } },
    });
    if (error) throw new Error(error.message);
    return { needsEmailConfirmation: !data.session };
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async signInWithEmail(email: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
  }

  async setPassword(password: string): Promise<void> {
    const { error } = await this.sb.auth.updateUser({
      password,
      data: { has_password: true },
    });
    if (error) throw new Error(error.message);
    await this.refreshAuthProfile();
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    if (error) throw new Error(error.message);
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async listMockUsers(): Promise<Profile[]> {
    return [];
  }

  async signInAsMockUser(): Promise<void> {
    throw new Error('Mock users are only available with VITE_MOCK=1.');
  }

  async claimUsername(username: string): Promise<Profile> {
    const uid = this.uid();
    const { data, error } = await this.sb
      .from('profiles')
      .update({ username })
      .eq('id', uid)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('That username is taken.');
      throw new Error(error.message);
    }
    const profile = this.mapProfile(data as ProfileRow);
    this.setUser(profile);
    return profile;
  }

  async uploadAvatar(image: Blob): Promise<string> {
    const uid = this.uid();
    const path = `${uid}/avatar-${Date.now()}.jpg`;
    const { error } = await this.sb.storage
      .from('listing-images')
      .upload(path, image, { contentType: 'image/jpeg' });
    if (error) throw new Error(`Avatar upload failed: ${error.message}`);
    return path;
  }

  async updateProfile(patch: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
  }): Promise<Profile> {
    const uid = this.uid();
    const row: Record<string, unknown> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.bio !== undefined) row.bio = patch.bio;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    const { data, error } = await this.sb
      .from('profiles')
      .update(row)
      .eq('id', uid)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const profile = this.mapProfile(data as ProfileRow);
    this.setUser(profile);
    return profile;
  }

  // ---- Profiles -----------------------------------------------------------

  async getProfileByUsername(username: string): Promise<Profile | null> {
    const { data } = await this.sb
      .from('profiles')
      .select('*')
      .ilike('username', username)
      .maybeSingle();
    return data ? this.mapProfile(data as ProfileRow) : null;
  }

  async getProfile(id: string): Promise<Profile | null> {
    const { data } = await this.sb.from('profiles').select('*').eq('id', id).maybeSingle();
    return data ? this.mapProfile(data as ProfileRow) : null;
  }

  private async buildSellerStats(profiles: Profile[]): Promise<SellerStats[]> {
    if (profiles.length === 0) return [];
    const ids = profiles.map((p) => p.id);
    const { data } = await this.sb
      .from('listings')
      .select('seller_id, game, status')
      .in('seller_id', ids)
      .in('status', ['active', 'sold']);
    const rows = (data ?? []) as { seller_id: string; game: string; status: string }[];
    const stats = profiles.map((p) => {
      const mine = rows.filter((r) => r.seller_id === p.id);
      const active = mine.filter((r) => r.status === 'active');
      const gameCounts = new Map<string, number>();
      for (const r of active) gameCounts.set(r.game, (gameCounts.get(r.game) ?? 0) + 1);
      return {
        profile: p,
        rank: 0,
        activeCount: active.length,
        soldCount: mine.filter((r) => r.status === 'sold').length,
        games: [...gameCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([g]) => g) as SellerStats['games'],
      };
    });
    return stats
      .sort(
        (a, b) =>
          b.profile.ratingCount - a.profile.ratingCount ||
          (b.profile.ratingAvg ?? 0) - (a.profile.ratingAvg ?? 0) ||
          b.activeCount - a.activeCount,
      )
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  async listSellers(limit: number): Promise<SellerStats[]> {
    const { data } = await this.sb
      .from('profiles')
      .select('*')
      .not('username', 'is', null)
      .order('rating_count', { ascending: false })
      .limit(Math.max(limit * 3, 30));
    const profiles = ((data ?? []) as ProfileRow[]).map((p) => this.mapProfile(p));
    return (await this.buildSellerStats(profiles)).slice(0, limit);
  }

  async getSellerStats(userId: string): Promise<SellerStats | null> {
    // Rank within the same pool listSellers uses.
    const pool = await this.listSellers(100);
    const found = pool.find((s) => s.profile.id === userId);
    if (found) return found;
    const profile = await this.getProfile(userId);
    if (!profile) return null;
    const [stats] = await this.buildSellerStats([profile]);
    return { ...stats, rank: pool.length + 1 };
  }

  // ---- Listings (read) ----------------------------------------------------

  /** Bulk like counts from the listing_likes view (0008). */
  private async likesFor(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    // Non-fatal: a missing listing_likes view (migration 0008 not applied)
    // should degrade to zero counts, not break browsing.
    const { data, error } = await this.sb.from('listing_likes').select('*').in('listing_id', ids);
    if (error) return new Map();
    return new Map(
      ((data ?? []) as { listing_id: string; likes: number }[]).map((r) => [
        r.listing_id,
        Number(r.likes),
      ]),
    );
  }

  async searchListings(filter: ListingFilter, offset: number, limit: number): Promise<ListingPage> {
    if ((filter.saleType ?? 'all') === 'auction' || filter.sort === 'ending_soon') {
      // A stale auction must never render as live if cron is behind.
      void this.sb.rpc('close_due_auctions').then(() => undefined, () => undefined);
    }
    if (filter.sort === 'ending_soon') {
      return this.searchEndingSoon(filter, offset, limit);
    }
    if (filter.sort === 'most_watched') {
      return this.searchMostWatched(filter, offset, limit);
    }
    let q = this.sb
      .from('listings')
      .select(
        `${LISTING_SELECT}, seller:profiles!${filter.sellerHasReviews ? 'inner' : 'listings_seller_id_fkey'}(*)`,
        { count: 'exact' },
      )
      .eq('status', 'active');
    if (filter.sellerHasReviews) q = q.gt('seller.rating_count', 0);

    if (filter.games.length) q = q.in('game', filter.games);
    if (filter.conditions.length) q = q.in('condition', filter.conditions);
    if (filter.finishes.length) q = q.in('finish', filter.finishes);
    if (filter.priceMin !== null) q = q.gte('price', filter.priceMin);
    if (filter.priceMax !== null) q = q.lte('price', filter.priceMax);
    if (filter.gradedOnly) q = q.not('grade_value', 'is', null);
    if ((filter.saleType ?? 'all') !== 'all') q = q.eq('sale_type', filter.saleType);
    if (filter.hasPregrade) {
      const ids = await this.pregradeListingIds();
      if (ids.length === 0) return { items: [], total: 0, hasMore: false };
      q = q.in('id', ids);
    }
    if (filter.language) q = q.ilike('language', filter.language);
    for (const term of filter.q.toLowerCase().split(/\s+/).filter(Boolean)) {
      const like = `%${term.replaceAll('%', '\\%')}%`;
      q = q.or(`title.ilike.${like},set_name.ilike.${like}`);
    }
    switch (filter.sort) {
      case 'price_asc':
        q = q.order('price', { ascending: true });
        break;
      case 'price_desc':
        q = q.order('price', { ascending: false });
        break;
      default:
        q = q.order('created_at', { ascending: false });
    }
    q = q.order('id', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data as (ListingRow & { seller: ProfileRow })[];
    const [likes, pills] = await Promise.all([
      this.likesFor(rows.map((r) => r.id)),
      this.pregradePillsFor(rows.map((r) => r.id)),
    ]);
    const items = rows.map((row) => ({
      ...this.mapListing(row),
      auction: this.auctionOf(row),
      seller: this.mapProfile(row.seller),
      sellerActiveListingCount: 0, // filled on the detail page only
      likes: likes.get(row.id) ?? 0,
      pregradePill: pills.get(row.id) ?? null,
    }));
    const total = count ?? items.length;
    return { items, total, hasMore: offset + items.length < total };
  }

  /** Ending-soon: order comes from the auctions table, so page there
      first and hydrate the listings in that order. */
  private async searchEndingSoon(
    filter: ListingFilter,
    offset: number,
    limit: number,
  ): Promise<ListingPage> {
    const { data, error } = await this.sb
      .from('auctions')
      .select('listing_id, ends_at')
      .eq('status', 'live')
      .order('ends_at', { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const orderedIds = ((data ?? []) as { listing_id: string }[]).map((r) => r.listing_id);
    if (orderedIds.length === 0) return { items: [], total: 0, hasMore: false };
    const page = await this.searchListings(
      { ...filter, saleType: 'auction', sort: 'newest' },
      0,
      orderedIds.length,
    );
    const byId = new Map(page.items.map((i) => [i.id, i]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));
    return {
      items: ordered.slice(offset, offset + limit),
      total: ordered.length,
      hasMore: offset + limit < ordered.length,
    };
  }

  /** Listing ids carrying a published pre-grade report. */
  private async pregradeListingIds(): Promise<string[]> {
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .select('listing_id')
      .eq('published', true)
      .not('listing_id', 'is', null);
    if (error) return [];
    return ((data ?? []) as { listing_id: string }[]).map((r) => r.listing_id);
  }

  /** Small "EST. 9–10" pills for a page of listings, one query. */
  private async pregradePillsFor(ids: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (ids.length === 0) return map;
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .select('listing_id, base_grade, is_ceiling, recommendation, p10, p9, p8, p_low')
      .eq('published', true)
      .in('listing_id', ids);
    if (error) return map;
    for (const r of (data ?? []) as Array<{
      listing_id: string;
      base_grade: number;
      is_ceiling: boolean;
      recommendation: PregradeReport['recommendation'];
      p10: number | string;
      p9: number | string;
      p8: number | string;
      p_low: number | string;
    }>) {
      map.set(
        r.listing_id,
        pregradePillLabel({
          base: r.base_grade,
          isCeiling: r.is_ceiling,
          recommendation: r.recommendation,
          band: { p10: Number(r.p10), p9: Number(r.p9), p8: Number(r.p8), pLow: Number(r.p_low) },
        }),
      );
    }
    return map;
  }

  /** most_watched sort: page through the likes view, then backfill with
      newest zero-like listings once the liked pool is exhausted. */
  private async searchMostWatched(
    filter: ListingFilter,
    offset: number,
    limit: number,
  ): Promise<ListingPage> {
    const { data: likedRows, error: likesError } = await this.sb
      .from('listing_likes')
      .select('*')
      .order('likes', { ascending: false })
      .limit(500);
    if (likesError) {
      // View missing — fall back to newest ordering.
      return this.searchListings({ ...filter, sort: 'newest' }, offset, limit);
    }
    const likedIds = ((likedRows ?? []) as { listing_id: string; likes: number }[]).map(
      (r) => r.listing_id,
    );
    // Fetch a page worth of candidates: liked ones (in view order) that
    // match the filter, then newest unliked ones.
    const newestPageSize = offset + limit + likedIds.length;
    const base = await this.searchListings(
      { ...filter, sort: 'newest' },
      0,
      Math.min(newestPageSize, 1000),
    );
    const rankById = new Map(likedIds.map((id, i) => [id, i]));
    const ordered = [...base.items].sort((a, b) => {
      const ra = rankById.has(a.id) ? rankById.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rankById.has(b.id) ? rankById.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ra - rb || b.createdAt.localeCompare(a.createdAt);
    });
    return {
      items: ordered.slice(offset, offset + limit),
      total: base.total,
      hasMore: offset + limit < base.total,
    };
  }

  async getListing(id: string): Promise<ListingWithSeller | null> {
    const { data } = await this.sb
      .from('listings')
      .select(`${LISTING_SELECT}, seller:profiles!listings_seller_id_fkey(*)`)
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    const row = data as ListingRow & { seller: ProfileRow };
    const { count } = await this.sb
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', row.seller_id)
      .eq('status', 'active');
    const [likes, pills] = await Promise.all([
      this.likesFor([row.id]),
      this.pregradePillsFor([row.id]),
    ]);
    return {
      ...this.mapListing(row),
      auction: this.auctionOf(row),
      seller: this.mapProfile(row.seller),
      sellerActiveListingCount: count ?? 0,
      likes: likes.get(row.id) ?? 0,
      pregradePill: pills.get(row.id) ?? null,
    };
  }

  async getListingsBySeller(sellerId: string, statuses: ListingStatus[]): Promise<Listing[]> {
    const { data, error } = await this.sb
      .from('listings')
      .select(LISTING_SELECT)
      .eq('seller_id', sellerId)
      .in('status', statuses)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as ListingRow[]).map((row) => this.mapListing(row));
  }

  subscribeToListing(id: string, cb: (listing: Listing) => void): Unsubscribe {
    const channel = this.sb
      .channel(`listing-${id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'listings', filter: `id=eq.${id}` },
        () => {
          // Payload lacks joined images — refetch the full row.
          void this.getListing(id).then((l) => l && cb(l));
        },
      )
      .subscribe();
    return () => void this.sb.removeChannel(channel);
  }

  // ---- Listings (write) ---------------------------------------------------

  private async uploadImage(listingId: string, draft: ImageDraft, index: number): Promise<string> {
    const uid = this.uid();
    const path = `${uid}/${listingId}/${Date.now()}-${index}.jpg`;
    const { error } = await this.sb.storage
      .from('listing-images')
      .upload(path, draft.file!, { contentType: 'image/jpeg' });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    return path;
  }

  private async syncImages(listingId: string, images: ImageDraft[], existing: ListingImageRow[]) {
    // Remove rows whose drafts are gone (best-effort delete of the object).
    const keptIds = new Set(images.filter((i) => i.kind === 'existing').map((i) => i.id));
    const removed = existing.filter((row) => !keptIds.has(row.id));
    if (removed.length) {
      await this.sb.from('listing_images').delete().in('id', removed.map((r) => r.id));
      await this.sb.storage.from('listing-images').remove(removed.map((r) => r.storage_path));
    }
    // Upload new files, then upsert final ordering.
    for (let i = 0; i < images.length; i++) {
      const draft = images[i];
      if (draft.kind === 'new') {
        const path = await this.uploadImage(listingId, draft, i);
        const { error } = await this.sb.from('listing_images').insert({
          listing_id: listingId,
          storage_path: path,
          sort_order: i,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await this.sb
          .from('listing_images')
          .update({ sort_order: i })
          .eq('id', draft.id);
        if (error) throw new Error(error.message);
      }
    }
  }

  private listingInputToRow(input: ListingInput): Record<string, unknown> {
    return {
      title: input.title,
      game: input.game,
      set_name: input.setName,
      card_number: input.cardNumber,
      language: input.language,
      condition: input.condition,
      finish: input.finish,
      grade_company: input.gradeCompany,
      grade_value: input.gradeValue,
      price: input.price,
      currency: input.currency,
      quantity: input.quantity,
      description: input.description,
    };
  }

  async createListing(input: ListingInput, images: ImageDraft[]): Promise<Listing> {
    const uid = this.uid();
    const { data, error } = await this.sb
      .from('listings')
      .insert({ ...this.listingInputToRow(input), seller_id: uid })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = data as ListingRow;
    await this.syncImages(row.id, images, []);
    return (await this.getListing(row.id))!;
  }

  async updateListing(id: string, input: ListingInput, images: ImageDraft[]): Promise<Listing> {
    const [{ data: existingImages }, { data: existingRow }] = await Promise.all([
      this.sb.from('listing_images').select('*').eq('listing_id', id),
      this.sb.from('listings').select('sale_type').eq('id', id).maybeSingle(),
    ]);
    const row = this.listingInputToRow(input);
    // An auction listing's price mirrors the current bid — edits never move it.
    if ((existingRow as { sale_type?: string } | null)?.sale_type === 'auction') delete row.price;
    const { error } = await this.sb
      .from('listings')
      .update(row)
      .eq('id', id);
    if (error) throw new Error(error.message);
    await this.syncImages(id, images, (existingImages ?? []) as ListingImageRow[]);
    return (await this.getListing(id))!;
  }

  async setListingStatus(
    id: string,
    status: ListingStatus,
    opts?: { reservedForConversationId?: string | null },
  ): Promise<Listing> {
    const { error } = await this.sb
      .from('listings')
      .update({
        status,
        reserved_for_conversation_id:
          status === 'reserved' ? (opts?.reservedForConversationId ?? null) : null,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    const listing = await this.getListing(id);
    if (!listing) throw new Error('Listing not found');
    return listing;
  }

  // ---- Auctions -----------------------------------------------------------

  async createAuctionListing(
    input: ListingInput,
    images: ImageDraft[],
    auction: AuctionInput,
  ): Promise<Listing> {
    // Listing + auction must land in ONE transaction (deferred pairing
    // constraint), so creation is an RPC; images follow separately.
    const { data, error } = await this.sb.rpc('create_auction_listing', {
      p_input: this.listingInputToRow(input),
      p_starting_price: auction.startingPrice,
      p_reserve_price: auction.reservePrice,
      p_duration_hours: auction.durationHours,
    });
    if (error) throw new Error(error.message);
    const listingId = data as string;
    await this.syncImages(listingId, images, []);
    return (await this.getListing(listingId))!;
  }

  async getAuctionForListing(listingId: string): Promise<AuctionDetail | null> {
    // Lazy close first: a stale auction must never read as live.
    await this.sb.rpc('close_due_auctions').then(
      () => undefined,
      () => undefined,
    );
    const { data, error } = await this.sb
      .from('auctions')
      .select('*, bids(*, bidder:profiles!bids_bidder_id_fkey(username, display_name))')
      .eq('listing_id', listingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as AuctionRow & { bids?: BidRow[] };
    const bids = (row.bids ?? [])
      .map((b) => this.mapBid(b))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.amount - a.amount);
    let myNoShowReported = false;
    const uid = this.auth.user?.id;
    if (uid && row.status === 'closed' && row.winner_id) {
      const { count } = await this.sb
        .from('auction_no_shows')
        .select('id', { count: 'exact', head: true })
        .eq('auction_id', row.id)
        .eq('reporter_id', uid);
      myNoShowReported = (count ?? 0) > 0;
    }
    return { auction: this.mapAuction(row), bids, myNoShowReported };
  }

  async placeBid(auctionId: string, amount: number): Promise<PlacedBid> {
    const { data, error } = await this.sb.rpc('place_bid', {
      p_auction_id: auctionId,
      p_amount: amount,
    });
    if (error) throw new Error(error.message);
    const out = data as { amount: number | string; ends_at: string; extended: boolean };
    return { amount: Number(out.amount), endsAt: out.ends_at, extended: out.extended };
  }

  subscribeToAuction(auctionId: string, cb: (ev: AuctionEvent) => void): Unsubscribe {
    let latest: Auction | null = null;
    const refetch = async (bid?: Bid) => {
      const { data } = await this.sb
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .maybeSingle();
      if (!data) return;
      latest = this.mapAuction(data as AuctionRow);
      cb(bid ? { type: 'bid', auction: latest, bid } : { type: 'updated', auction: latest });
    };
    const channel = this.sb
      .channel(`auction-${auctionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=eq.${auctionId}` },
        (payload) => {
          const row = payload.new as BidRow;
          // Bidder handle needs a lookup; refetch keeps it one code path.
          void this.sb
            .from('profiles')
            .select('username, display_name')
            .eq('id', row.bidder_id)
            .maybeSingle()
            .then(({ data: p }) => {
              void refetch(
                this.mapBid({
                  ...row,
                  bidder: (p as { username: string | null; display_name: string } | null) ?? null,
                }),
              );
            });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` },
        (payload) => {
          latest = this.mapAuction(payload.new as AuctionRow);
          cb({ type: 'updated', auction: latest });
        },
      )
      .subscribe();
    return () => {
      void this.sb.removeChannel(channel);
    };
  }

  async endAuctionEarly(auctionId: string): Promise<void> {
    const { error } = await this.sb.rpc('end_auction_early', { p_auction_id: auctionId });
    if (error) throw new Error(error.message);
  }

  async cancelAuction(auctionId: string, reason: string): Promise<void> {
    const { error } = await this.sb.rpc('cancel_auction', {
      p_auction_id: auctionId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  }

  async reportAuctionNoShow(auctionId: string): Promise<void> {
    const { error } = await this.sb.rpc('report_auction_no_show', {
      p_auction_id: auctionId,
    });
    if (error) throw new Error(error.message);
  }

  async getAuctionNoShowCount(userId: string): Promise<number> {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { count } = await this.sb
      .from('auction_no_shows')
      .select('id', { count: 'exact', head: true })
      .eq('reported_id', userId)
      .eq('role', 'winner')
      .gt('created_at', since);
    return count ?? 0;
  }

  // ---- Favorites ----------------------------------------------------------

  async getFavoriteIds(): Promise<Set<string>> {
    if (!this.auth.user) return new Set();
    const { data } = await this.sb.from('favorites').select('listing_id');
    return new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id));
  }

  async getFavoriteListings(): Promise<ListingWithSeller[]> {
    const { data, error } = await this.sb
      .from('favorites')
      .select(
        `listing:listings(${LISTING_SELECT}, seller:profiles!listings_seller_id_fkey(*))`,
      )
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? [])
      .map((r) => (r as unknown as { listing: (ListingRow & { seller: ProfileRow }) | null }).listing)
      .filter((row): row is ListingRow & { seller: ProfileRow } => row !== null)
      .filter((row) => row.status !== 'removed');
    const likes = await this.likesFor(rows.map((r) => r.id));
    return rows.map((row) => ({
      ...this.mapListing(row),
      seller: this.mapProfile(row.seller),
      sellerActiveListingCount: 0,
      likes: likes.get(row.id) ?? 0,
    }));
  }

  async setFavorite(listingId: string, favorited: boolean): Promise<void> {
    const uid = this.uid();
    if (favorited) {
      const { error } = await this.sb
        .from('favorites')
        .upsert({ user_id: uid, listing_id: listingId });
      if (error) throw new Error(error.message);
    } else {
      await this.sb.from('favorites').delete().eq('user_id', uid).eq('listing_id', listingId);
    }
  }

  // ---- Chat ---------------------------------------------------------------

  private async summarizeConversations(rows: ConversationRow[]): Promise<ConversationSummary[]> {
    if (rows.length === 0) return [];
    const me = this.uid();
    const convIds = rows.map((r) => r.id);
    const otherIds = [...new Set(rows.map((r) => (r.buyer_id === me ? r.seller_id : r.buyer_id)))];
    const listingIds = [...new Set(rows.map((r) => r.listing_id))];

    const [{ data: profiles }, { data: listings }, { data: lastMessages }, { data: unread }] =
      await Promise.all([
        this.sb.from('profiles').select('*').in('id', otherIds),
        this.sb.from('listings').select(LISTING_SELECT).in('id', listingIds),
        // Most recent messages across these conversations; grouped client-side.
        this.sb
          .from('messages')
          .select('*')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(Math.max(100, convIds.length * 3)),
        this.sb
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .eq('kind', 'user')
          .neq('sender_id', me)
          .is('read_at', null),
      ]);

    const profileById = new Map((profiles ?? []).map((p: ProfileRow) => [p.id, this.mapProfile(p)]));
    const listingById = new Map(
      ((listings ?? []) as ListingRow[]).map((l) => [l.id, this.mapListing(l)]),
    );
    const lastByConv = new Map<string, Message>();
    for (const m of (lastMessages ?? []) as MessageRow[]) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, this.mapMessage(m));
    }
    const unreadByConv = new Map<string, number>();
    for (const u of (unread ?? []) as { conversation_id: string }[]) {
      unreadByConv.set(u.conversation_id, (unreadByConv.get(u.conversation_id) ?? 0) + 1);
    }

    return rows
      .filter((r) => listingById.has(r.listing_id) && profileById.has(r.buyer_id === me ? r.seller_id : r.buyer_id))
      .map((r) => ({
        id: r.id,
        listingId: r.listing_id,
        buyerId: r.buyer_id,
        sellerId: r.seller_id,
        createdAt: r.created_at,
        lastMessageAt: r.last_message_at,
        listing: listingById.get(r.listing_id)!,
        otherParty: profileById.get(r.buyer_id === me ? r.seller_id : r.buyer_id)!,
        lastMessage: lastByConv.get(r.id) ?? null,
        unreadCount: unreadByConv.get(r.id) ?? 0,
      }));
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const { data, error } = await this.sb
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false });
    if (error) throw new Error(error.message);
    return this.summarizeConversations((data ?? []) as ConversationRow[]);
  }

  async getConversation(id: string): Promise<ConversationSummary | null> {
    const { data } = await this.sb.from('conversations').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    const [summary] = await this.summarizeConversations([data as ConversationRow]);
    return summary ?? null;
  }

  async openConversation(listingId: string): Promise<Conversation> {
    const { data, error } = await this.sb.rpc('open_conversation', { p_listing_id: listingId });
    if (error) {
      // Surface the raise exception message without the PG prefix noise.
      throw new Error(error.message.replace(/^.*?:\s*/, ''));
    }
    const row = data as ConversationRow;
    return {
      id: row.id,
      listingId: row.listing_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      createdAt: row.created_at,
      lastMessageAt: row.last_message_at,
    };
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await this.sb
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as MessageRow[]).map((m) => this.mapMessage(m));
  }

  async sendMessage(conversationId: string, body: string, clientId: string): Promise<Message> {
    const uid = this.uid();
    const { data, error } = await this.sb
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: uid, kind: 'user', body })
      .select()
      .single();
    if (error) {
      if (error.code === '42501') {
        throw new Error('You cannot message this user.');
      }
      throw new Error(error.message);
    }
    return { ...this.mapMessage(data as MessageRow), clientId };
  }

  async sendOffer(
    conversationId: string,
    amount: number,
    note: string,
    clientId: string,
  ): Promise<Message> {
    const uid = this.uid();
    const { data, error } = await this.sb
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: uid,
        kind: 'offer',
        body: note || 'Offer',
        amount,
        offer_status: 'proposed',
      })
      .select()
      .single();
    if (error) {
      if (error.code === '42501') throw new Error('You cannot message this user.');
      throw new Error(error.message);
    }
    return { ...this.mapMessage(data as MessageRow), clientId };
  }

  async respondToOffer(conversationId: string, messageId: string, accept: boolean): Promise<void> {
    const { error } = await this.sb
      .from('messages')
      .update({ offer_status: accept ? 'accepted' : 'declined' })
      .eq('id', messageId)
      .eq('conversation_id', conversationId);
    if (error) throw new Error(error.message);
  }

  sendTyping(conversationId: string): void {
    const channel = this.convChannels.get(conversationId);
    if (channel && this.auth.user) {
      void channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: this.auth.user.id },
      });
    }
  }

  async markConversationRead(conversationId: string): Promise<void> {
    const uid = this.uid();
    await this.sb
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', uid)
      .is('read_at', null);
  }

  subscribeToConversation(
    conversationId: string,
    cb: (ev: ConversationEvent) => void,
  ): Unsubscribe {
    let listingUnsub: Unsubscribe | null = null;
    // Watch the conversation's listing for live status changes.
    void this.sb
      .from('conversations')
      .select('listing_id')
      .eq('id', conversationId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          listingUnsub = this.subscribeToListing((data as { listing_id: string }).listing_id, (listing) =>
            cb({ type: 'listing_updated', conversationId, listing }),
          );
        }
      });

    const channel = this.sb
      .channel(`conv-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          cb({
            type: 'message',
            conversationId,
            message: this.mapMessage(payload.new as MessageRow),
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => cb({ type: 'refresh', conversationId }),
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const from = (payload.payload as { userId?: string } | undefined)?.userId;
        if (from && from !== this.auth.user?.id) {
          cb({ type: 'typing', conversationId });
        }
      })
      .subscribe();
    this.convChannels.set(conversationId, channel);

    return () => {
      this.convChannels.delete(conversationId);
      void this.sb.removeChannel(channel);
      listingUnsub?.();
    };
  }

  subscribeToInbox(cb: () => void): Unsubscribe {
    const channel = this.sb
      .channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => cb(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => cb(),
      )
      .subscribe();
    return () => void this.sb.removeChannel(channel);
  }

  async getTotalUnreadCount(): Promise<number> {
    if (!this.auth.user) return 0;
    // RLS already scopes messages to conversations the user participates in.
    const { count } = await this.sb
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'user')
      .neq('sender_id', this.auth.user.id)
      .is('read_at', null);
    return count ?? 0;
  }

  // ---- Trust --------------------------------------------------------------

  async getReviewsForUser(userId: string): Promise<Review[]> {
    const { data, error } = await this.sb
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(*)')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ReviewRow[]).map((r) => this.mapReview(r));
  }

  async getConversationReviews(conversationId: string): Promise<Review[]> {
    const { data, error } = await this.sb
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(*)')
      .eq('conversation_id', conversationId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as ReviewRow[]).map((r) => this.mapReview(r));
  }

  async getReviewsWritten(): Promise<Review[]> {
    const { data, error } = await this.sb
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(*)')
      .eq('reviewer_id', this.uid())
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ReviewRow[]).map((r) => this.mapReview(r));
  }

  async getPendingReviews(): Promise<PendingReview[]> {
    const me = this.uid();
    const [convRes, reviewRes] = await Promise.all([
      this.sb.from('conversations').select('*, listing:listings!inner(*, listing_images(*))'),
      this.sb.from('reviews').select('conversation_id').eq('reviewer_id', me),
    ]);
    if (convRes.error) throw new Error(convRes.error.message);
    if (reviewRes.error) throw new Error(reviewRes.error.message);
    const convs = convRes.data;
    const myReviews = reviewRes.data;
    const reviewed = new Set(
      ((myReviews ?? []) as { conversation_id: string }[]).map((r) => r.conversation_id),
    );
    // Only the buyer reviews, and only once the listing is sold.
    const pending = ((convs ?? []) as (ConversationRow & { listing: ListingRow })[]).filter(
      (c) => c.buyer_id === me && c.listing.status === 'sold' && !reviewed.has(c.id),
    );
    if (pending.length === 0) return [];
    const sellerIds = [...new Set(pending.map((c) => c.seller_id))];
    const { data: profiles } = await this.sb.from('profiles').select('*').in('id', sellerIds);
    const profileById = new Map((profiles ?? []).map((p: ProfileRow) => [p.id, this.mapProfile(p)]));
    return pending
      .filter((c) => profileById.has(c.seller_id))
      .map((c) => ({
        conversationId: c.id,
        listing: this.mapListing(c.listing),
        otherParty: profileById.get(c.seller_id)!,
      }));
  }

  async submitReview(conversationId: string, rating: number, body: string): Promise<Review> {
    const me = this.uid();
    const { data: conv } = await this.sb
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    const c = conv as ConversationRow;
    // Buyer → seller only (migration 0010); RLS enforces it too.
    if (c.buyer_id !== me) {
      throw new Error('Only the buyer reviews the seller on a completed deal.');
    }
    const revieweeId = c.seller_id;
    const { data, error } = await this.sb
      .from('reviews')
      .insert({
        conversation_id: conversationId,
        listing_id: c.listing_id,
        reviewer_id: me,
        reviewee_id: revieweeId,
        rating,
        body,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('You already reviewed this trade.');
      if (error.code === '42501') throw new Error('Reviews open once the listing is marked sold.');
      throw new Error(error.message);
    }
    return this.mapReview(data as ReviewRow);
  }

  async submitReport(input: ReportInput): Promise<void> {
    const me = this.uid();
    const { error } = await this.sb.from('reports').insert({
      reporter_id: me,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason,
      detail: input.detail,
    });
    if (error) throw new Error(error.message);
  }

  async getBlockedIds(): Promise<Set<string>> {
    if (!this.auth.user) return new Set();
    const { data } = await this.sb.from('blocks').select('blocked_id');
    return new Set(((data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id));
  }

  async setBlocked(userId: string, blocked: boolean): Promise<void> {
    const me = this.uid();
    if (blocked) {
      const { error } = await this.sb
        .from('blocks')
        .upsert({ blocker_id: me, blocked_id: userId });
      if (error) throw new Error(error.message);
    } else {
      await this.sb.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId);
    }
  }

  // ---- Pre-grade ----------------------------------------------------------

  async assessPregrade(input: {
    images: { slot: string; blob: Blob }[];
    hasRake: boolean;
    caseHint?: string;
  }): Promise<DefectAssessment> {
    const { data: sess } = await this.sb.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error('Sign in to run an assessment.');
    const images = await Promise.all(
      input.images.map(async (img) => ({ slot: img.slot, dataUrl: await blobToDataUrl(img.blob) })),
    );
    const r = await fetch('/api/pregrade/assess', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ images, hasRake: input.hasRake }),
    });
    const body = (await r.json().catch(() => null)) as
      | { assessment?: DefectAssessment; error?: string }
      | null;
    if (!r.ok || !body?.assessment) {
      throw new Error(body?.error ?? `Assessment failed (${r.status}).`);
    }
    return body.assessment;
  }

  private mapPregrade(row: PregradeRow): PregradeReport {
    const captures: PregradeReport['captures'] = {};
    for (const c of row.pregrade_captures ?? []) {
      captures[c.slot] = c.path;
    }
    const findings = row.findings as unknown as DefectAssessment;
    return {
      id: row.id,
      userId: row.user_id,
      listingId: row.listing_id,
      published: row.published,
      standardsVersion: row.standards_version,
      era: row.era,
      centeringMethod: row.centering_method,
      front: {
        leftRight: [Number(row.front_lr), Math.round((100 - Number(row.front_lr)) * 10) / 10] as AxisRatio,
        topBottom: [Number(row.front_tb), Math.round((100 - Number(row.front_tb)) * 10) / 10] as AxisRatio,
      },
      back:
        row.back_lr !== null && row.back_tb !== null
          ? {
              leftRight: [Number(row.back_lr), Math.round((100 - Number(row.back_lr)) * 10) / 10] as AxisRatio,
              topBottom: [Number(row.back_tb), Math.round((100 - Number(row.back_tb)) * 10) / 10] as AxisRatio,
            }
          : null,
      scoreCentering: row.score_centering,
      scoreCorners: row.score_corners,
      scoreEdges: row.score_edges,
      scoreSurface: row.score_surface,
      base: row.base_grade,
      isCeiling: row.is_ceiling,
      band: {
        p10: Number(row.p10),
        p9: Number(row.p9),
        p8: Number(row.p8),
        pLow: Number(row.p_low),
      },
      confidence: row.confidence,
      recommendation: row.recommendation,
      assessment: findings,
      notes: (row.notes as unknown as string[]) ?? [],
      modelId: row.model_id,
      createdAt: row.created_at,
      diagram: (row.diagram as PregradeReport['diagram']) ?? null,
      outcome: row.pregrade_outcomes?.[0]
        ? {
            actualGrade: row.pregrade_outcomes[0].actual_grade,
            certNumber: row.pregrade_outcomes[0].cert_number,
            reportedAt: row.pregrade_outcomes[0].reported_at,
          }
        : null,
      captures,
    };
  }

  /** Turn stored capture paths into time-limited viewable URLs. */
  private async signCaptures(report: PregradeReport): Promise<PregradeReport> {
    const entries = Object.entries(report.captures) as [CaptureSlot, string][];
    const signed = await Promise.all(
      entries.map(async ([slot, path]) => {
        const { data } = await this.sb.storage
          .from('pregrade-captures')
          .createSignedUrl(path, 3600);
        return [slot, data?.signedUrl ?? ''] as const;
      }),
    );
    const captures: PregradeReport['captures'] = {};
    for (const [slot, url] of signed) if (url) captures[slot] = url;
    return { ...report, captures };
  }

  private static readonly PREGRADE_SELECT =
    '*, pregrade_captures(*), pregrade_outcomes(*)';

  async savePregradeReport(input: PregradeReportInput): Promise<PregradeReport> {
    const me = this.uid();
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .insert({
        user_id: me,
        standards_version: CURRENT_STANDARD.version,
        era: input.era,
        centering_method: input.centeringMethod,
        front_lr: input.front.leftRight[0],
        front_tb: input.front.topBottom[0],
        back_lr: input.back?.leftRight[0] ?? null,
        back_tb: input.back?.topBottom[0] ?? null,
        score_centering: input.scores.centering,
        score_corners: input.scores.corners,
        score_edges: input.scores.edges,
        score_surface: input.scores.surface,
        base_grade: input.estimate.base,
        is_ceiling: input.estimate.isCeiling,
        p10: input.estimate.band.p10,
        p9: input.estimate.band.p9,
        p8: input.estimate.band.p8,
        p_low: input.estimate.band.pLow,
        confidence: input.estimate.confidence,
        recommendation: input.estimate.recommendation,
        findings: input.assessment,
        notes: input.estimate.notes,
        diagram: input.diagram,
        model_id: 'api',
      })
      .select(SupabaseMarketplaceClient.PREGRADE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    const report = data as unknown as PregradeRow;
    // Captures: 2400px WebP into the private bucket at {uid}/{report}/{slot}.
    for (const c of input.captures) {
      const stored = await toStorageImage(c.blob);
      const ext = stored.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${me}/${report.id}/${c.slot}.${ext}`;
      const { error: upErr } = await this.sb.storage
        .from('pregrade-captures')
        .upload(path, stored, { contentType: stored.type, upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { error: rowErr } = await this.sb.from('pregrade_captures').insert({
        report_id: report.id,
        slot: c.slot,
        path,
      });
      if (rowErr) throw new Error(rowErr.message);
    }
    const full = await this.getPregradeReport(report.id);
    if (!full) throw new Error('Report vanished after save.');
    return full;
  }

  async listMyPregradeReports(): Promise<PregradeReport[]> {
    const me = this.uid();
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .select(SupabaseMarketplaceClient.PREGRADE_SELECT)
      .eq('user_id', me)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return Promise.all(
      ((data ?? []) as unknown as PregradeRow[]).map((r) => this.signCaptures(this.mapPregrade(r))),
    );
  }

  async getPregradeReport(id: string): Promise<PregradeReport | null> {
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .select(SupabaseMarketplaceClient.PREGRADE_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.signCaptures(this.mapPregrade(data as unknown as PregradeRow)) : null;
  }

  async getPublishedPregradeReport(listingId: string): Promise<PregradeReport | null> {
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .select(SupabaseMarketplaceClient.PREGRADE_SELECT)
      .eq('listing_id', listingId)
      .eq('published', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.signCaptures(this.mapPregrade(data as unknown as PregradeRow)) : null;
  }

  async publishPregradeReport(reportId: string, listingId: string): Promise<PregradeReport> {
    const report = await this.getPregradeReport(reportId);
    if (!report) throw new Error('Report not found.');
    const listing = await this.getListing(listingId);
    if (!listing) throw new Error('Listing not found.');
    // The abuse gate: the report's front capture must look like the
    // listing's cover image.
    const front = report.captures.front;
    const cover = listing.images[0]?.url ?? null;
    if (front && cover && !(await capturesMatchCover(front, cover))) {
      throw new Error(PHASH_MISMATCH_COPY);
    }
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .update({ listing_id: listingId, published: true })
      .eq('id', reportId)
      .select(SupabaseMarketplaceClient.PREGRADE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return this.signCaptures(this.mapPregrade(data as unknown as PregradeRow));
  }

  async unpublishPregradeReport(reportId: string): Promise<PregradeReport> {
    const { data, error } = await this.sb
      .from('pregrade_reports')
      .update({ published: false })
      .eq('id', reportId)
      .select(SupabaseMarketplaceClient.PREGRADE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return this.signCaptures(this.mapPregrade(data as unknown as PregradeRow));
  }

  async recordPregradeOutcome(
    reportId: string,
    actualGrade: number,
    certNumber?: string,
  ): Promise<void> {
    const { error } = await this.sb.from('pregrade_outcomes').insert({
      report_id: reportId,
      actual_grade: actualGrade,
      cert_number: certNumber ?? null,
    });
    if (error) throw new Error(error.message);
  }

  // ---- Storage ------------------------------------------------------------

  resolveImageUrl(storagePath: string): string {
    if (storagePath.startsWith('http') || storagePath.startsWith('data:') || storagePath.startsWith('blob:')) {
      return storagePath;
    }
    return this.sb.storage.from('listing-images').getPublicUrl(storagePath).data.publicUrl;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(blob);
  });
}
