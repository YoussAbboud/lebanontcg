import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListingFilter, ListingWithSeller } from '../lib/types';
import {
  DEFAULT_FILTER,
  filterFromSearchParams,
  filterToSearchParams,
  isDefaultFilter,
} from '../lib/filter';
import { useApp } from '../state/AppContext';
import { FilterBar } from '../components/FilterBar';
import { ListingCard } from '../components/ListingCard';
import { ListingCarousel } from '../components/ListingCarousel';
import './browse.css';

const PAGE_SIZE = 24;
const RAIL_SIZE = 10;

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
  const [railItems, setRailItems] = useState<ListingWithSeller[]>([]);
  const requestSeq = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // Featured rail: newest active listings, independent of the filters.
  useEffect(() => {
    let cancelled = false;
    client
      .searchListings(DEFAULT_FILTER, 0, RAIL_SIZE)
      .then((page) => {
        if (!cancelled) setRailItems(page.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

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
        <span className="browse-hero-chip glass">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path
              d="M8 1l1.6 4.1L14 6l-4.4 1.4L8 12 6.4 7.4 2 6l4.4-.9L8 1zm5 8l.7 1.8 1.8.7-1.8.7L13 14l-.7-1.8-1.8-.7 1.8-.7L13 9z"
              fill="currentColor"
            />
          </svg>
          Discover
        </span>
        <h1 className="display browse-hero-title">
          <span className="hero-text">Discover and experience</span>
          <br />
          <span className="hero-text">the world of trading cards.</span>
        </h1>
        <p className="browse-hero-sub">
          Explore a new dimension of collecting with LebanonTCG, where the deal happens
          directly between collectors — no fees, no middleman.
        </p>
      </section>

      <ListingCarousel items={railItems} />

      <div className="browse-explore">
        <button
          className="btn btn-primary btn-lg"
          onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Explore
        </button>
      </div>

      <div className="browse-market" ref={gridRef}>
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
    </div>
  );
}
