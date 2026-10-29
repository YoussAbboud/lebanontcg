import type { SellerStats } from './types';

/**
 * The seller board (Top sellers on the home page, /sellers) only promotes
 * people with something public to show: a live or sold listing that passed
 * review, or a review from a buyer. A seller whose only listing is still in
 * review has neither yet. Ranks are renumbered after the filter so the board
 * has no gaps.
 */
export function rankablePool(stats: SellerStats[]): SellerStats[] {
  return stats
    .filter((s) => s.activeCount > 0 || s.soldCount > 0 || s.profile.ratingCount > 0)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
