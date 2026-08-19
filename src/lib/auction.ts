// Pure auction math + copy shared by the UI and the mock engine. The
// REAL rules live in Postgres (place_bid, migration 0013) — everything
// here is a nicety that must mirror them exactly.

import type { Auction } from './types';

/** Minimum next bid: 5% of the current bid rounded up to a whole unit,
    floor of 1 unit; the first bid may equal the starting price.
    Mirrors public.min_next_bid() — keep the two in sync. */
export function minNextBid(currentBid: number | null, startingPrice: number): number {
  if (currentBid === null) return startingPrice;
  return currentBid + Math.max(1, Math.ceil(currentBid * 0.05));
}

/** Milliseconds until close (never negative). */
export function timeLeftMs(endsAt: string, now = Date.now()): number {
  return Math.max(0, new Date(endsAt).getTime() - now);
}

/** True inside the final five minutes — the countdown turns acid and
    starts showing seconds. */
export function isEndingSoon(endsAt: string, now = Date.now()): boolean {
  const left = timeLeftMs(endsAt, now);
  return left > 0 && left < 5 * 60_000;
}

/**
 * Countdown copy: "2d 4h" → "2h 14m" → "14m" → under five minutes it
 * gains seconds ("4m 32s", "48s").
 */
export function formatTimeLeft(endsAt: string, now = Date.now()): string {
  const ms = timeLeftMs(endsAt, now);
  if (ms === 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (ms < 5 * 60_000) return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  return `${m}m`;
}

/** The grid pill for a live auction, e.g. "LIVE · 2h 14m". */
export function auctionPillLabel(auction: Auction, now = Date.now()): string | null {
  if (auction.status !== 'live') return null;
  if (timeLeftMs(auction.endsAt, now) === 0) return null;
  return `LIVE · ${formatTimeLeft(auction.endsAt, now)}`;
}

/** True when the auction should be treated as over even if a lagging
    closer hasn't flipped its status yet — never render a stale "live". */
export function isEffectivelyOver(auction: Auction, now = Date.now()): boolean {
  return auction.status !== 'live' || timeLeftMs(auction.endsAt, now) === 0;
}

export const BID_DISCLAIMER =
  "Bids aren't binding and no payment happens here. Winning just opens a chat with the seller.";
