import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListingFilter, ListingWithSeller } from '../lib/types';
import {
  filterFromSearchParams,
  filterToSearchParams,
  isDefaultFilter,
} from '../lib/filter';
import { useApp } from '../state/AppContext';
import { FilterBar } from '../components/FilterBar';
import { ListingCard } from '../components/ListingCard';
import './browse.css';

const PAGE_SIZE = 24;

type LoadState = 'loading' | 'ready' | 'error';

export function BrowsePage() {
  const { client } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = filterFromSearchParams(searchParams);
  const filterKey = filterToSearchParams(filter).toString();

  const [items, setItems] = useState<ListingWithSeller[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const requestSeq = useRef(0);

  const runSearch = useCallback(
    async (offset: number) => {
      const seq = ++requestSeq.current;
      if (offset === 0) setState('loading');
      else setLoadingMore(true);
      try {
        const page = await client.searchListings(filter, offset, PAGE_SIZE);
        if (seq !== requestSeq.current) return; // stale response
        setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setHasMore(page.hasMore);
        setState('ready');
      } catch {
        if (seq !== requestSeq.current) return;
        setState('error');
      } finally {
        if (seq === requestSeq.current) setLoadingMore(false);
      }
    },
    // filterKey is the canonical serialized form of `filter`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, filterKey],
  );

  useEffect(() => {
    void runSearch(0);
  }, [runSearch]);

  const onFilterChange = (next: ListingFilter) => {
    // Replace (not push) so typing doesn't spam history; keeps links shareable.
    setSearchParams(filterToSearchParams(next), { replace: true });
  };

  return (
    <div className="browse">
      <section className="browse-hero">
        <h1 className="display browse-hero-title">
          Find your next <span className="spectrum-text">chase card</span>
        </h1>
        <p className="browse-hero-sub">
          Peer-to-peer trading card marketplace — deal directly with collectors, no fees, no middleman.
        </p>
      </section>

      <FilterBar filter={filter} onChange={onFilterChange} />

      {state === 'loading' && (
        <div className="browse-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="browse-skeleton skeleton" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="empty-state" role="alert">
          <div className="empty-glyph" aria-hidden="true" />
          <h3 className="display">Couldn&apos;t load listings</h3>
          <p>Something went wrong fetching the marketplace. Give it another try.</p>
          <button className="btn btn-primary" onClick={() => void runSearch(0)}>
            Retry
          </button>
        </div>
      )}

      {state === 'ready' && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-glyph" aria-hidden="true" />
          <h3 className="display">No cards match</h3>
          <p>
            {isDefaultFilter(filter)
              ? 'Nothing is listed right now — be the first to post a card.'
              : 'Try loosening a filter or clearing the search.'}
          </p>
        </div>
      )}

      {state === 'ready' && items.length > 0 && (
        <>
          <p className="browse-count" role="status">
            Showing {items.length} of {total} listing{total === 1 ? '' : 's'}
          </p>
          <div className="browse-grid">
            {items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          {hasMore && (
            <div className="browse-more">
              <button
                className="btn btn-ghost btn-lg"
                disabled={loadingMore}
                onClick={() => void runSearch(items.length)}
              >
                {loadingMore ? 'Loading…' : 'Load more cards'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
