import { useEffect, useSyncExternalStore } from 'react';
import type { MarketplaceClient, Unsubscribe } from './client/MarketplaceClient';

/**
 * Live ♡ counts. A listing's like count is how many people watch it; every
 * card on screen follows its count through ONE shared realtime feed rather
 * than a channel per card. Counts heard from the feed (or set optimistically
 * by a click) override the number the listing was fetched with. When the
 * last card unmounts the feed closes and the heard counts are dropped, so a
 * later fetch is never shadowed by a number that has gone stale.
 */
const heard = new Map<string, number>();
const listeners = new Set<() => void>();
let feed: { client: MarketplaceClient; stop: Unsubscribe; users: number } | null = null;

export function setLikeCount(listingId: string, likes: number): void {
  if (heard.get(listingId) === likes) return;
  heard.set(listingId, likes);
  for (const l of listeners) l();
}

function attach(client: MarketplaceClient): () => void {
  if (feed && feed.client !== client) {
    feed.stop();
    feed = null;
    heard.clear();
  }
  feed ??= { client, stop: client.subscribeToLikeCounts(setLikeCount), users: 0 };
  feed.users++;
  const mine = feed;
  return () => {
    if (feed !== mine) return;
    mine.users--;
    if (mine.users === 0) {
      mine.stop();
      feed = null;
      heard.clear();
    }
  };
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The listing's current like count: live while mounted, `fetched` until
    anything newer is heard. */
export function useLikeCount(client: MarketplaceClient, listingId: string, fetched: number): number {
  useEffect(() => attach(client), [client]);
  const live = useSyncExternalStore(subscribe, () => heard.get(listingId));
  return live ?? fetched;
}
