import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListingFilter, ListingWithSeller } from '../lib/types';
import { CONDITIONS, GAMES, GAME_LABELS, FINISHES, FINISH_LABELS } from '../lib/types';
import { DEFAULT_FILTER, filterFromSearchParams, filterToSearchParams } from '../lib/filter';
import { useApp } from '../state/AppContext';
import { ListingCard } from '../components/ListingCard';
import './browse.css';

const PAGE_SIZE = 24;

const SORTS: Array<{ key: ListingFilter['sort']; label: string }> = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price ↑' },
  { key: 'price_desc', label: 'Price ↓' },
  { key: 'most_watched', label: 'Most watched' },
];

type LoadState = 'loading' | 'ready' | 'error';

export function BrowsePage() {
  const { client } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = filterFromSearchParams(searchParams);
  const filterKey = filterToSearchParams(filter).toString();
  const focusSearch = searchParams.get('focus') === '1';

  const [items, setItems] = useState<ListingWithSeller[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filter.q);
  const requestSeq = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setSearchDraft(filter.q), [filter.q]);

  useEffect(() => {
    if (focusSearch) {
      searchRef.current?.focus();
      // one-shot flag; keep the rest of the params
      const p = filterToSearchParams(filter);
      setSearchParams(p, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSearch]);

  const runSearch = useCallback(
    async (offset: number) => {
      const seq = ++requestSeq.current;
      if (offset === 0) setState('loading');
      else setLoadingMore(true);
      try {
        const page = await client.searchListings(filter, offset, PAGE_SIZE);
        if (seq !== requestSeq.current) return;
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

  const apply = (next: ListingFilter) => {
    setSearchParams(filterToSearchParams(next), { replace: true });
  };

  const setSearch = (value: string) => {
    setSearchDraft(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => apply({ ...filter, q: value }), 300);
  };

  const clearFilters = () => {
    setSearchDraft('');
    apply({ ...DEFAULT_FILTER, sort: filter.sort });
  };

  return (
    <div className="browse">
      <aside aria-label="Filters" className="panel browse-side">
        <div className="browse-side-head">
          <div className="mono-label">Filters</div>
          <button type="button" className="btn-ghost-mono browse-clear" onClick={clearFilters}>
            Clear
          </button>
        </div>

        <div className="mono-label browse-facet-label">Game</div>
        <div className="browse-chiprow">
          {GAMES.map((g) => (
            <button
              key={g}
              type="button"
              className="pill"
              aria-pressed={filter.games.includes(g)}
              onClick={() =>
                apply({
                  ...filter,
                  games: filter.games.includes(g)
                    ? filter.games.filter((x) => x !== g)
                    : [...filter.games, g],
                })
              }
            >
              {GAME_LABELS[g]}
            </button>
          ))}
        </div>

        <div className="mono-label browse-facet-label">Condition</div>
        <div className="browse-chiprow">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              className="pill"
              aria-pressed={filter.conditions.includes(c)}
              onClick={() =>
                apply({
                  ...filter,
                  conditions: filter.conditions.includes(c)
                    ? filter.conditions.filter((x) => x !== c)
                    : [...filter.conditions, c],
                })
              }
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mono-label browse-facet-label">Asking price</div>
        <div className="browse-price-row">
          <input
            type="number"
            aria-label="Minimum price"
            placeholder="Min"
            min="0"
            inputMode="numeric"
            className="input input-mono"
            value={filter.priceMin ?? ''}
            onChange={(e) =>
              apply({
                ...filter,
                priceMin: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
          />
          <input
            type="number"
            aria-label="Maximum price"
            placeholder="Max"
            min="0"
            inputMode="numeric"
            className="input input-mono"
            value={filter.priceMax ?? ''}
            onChange={(e) =>
              apply({
                ...filter,
                priceMax: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
          />
        </div>

        <div className="mono-label browse-facet-label">Finish</div>
        <select
          className="input browse-select"
          aria-label="Finish"
          value={filter.finishes[0] ?? ''}
          onChange={(e) =>
            apply({
              ...filter,
              finishes: e.target.value ? [e.target.value as ListingFilter['finishes'][number]] : [],
            })
          }
        >
          <option value="">Any finish</option>
          {FINISHES.map((f) => (
            <option key={f} value={f}>
              {FINISH_LABELS[f]}
            </option>
          ))}
        </select>

        <div className="mono-label browse-facet-label">Language</div>
        <select
          className="input browse-select"
          aria-label="Language"
          value={filter.language ?? ''}
          onChange={(e) => apply({ ...filter, language: e.target.value || null })}
        >
          <option value="">Any language</option>
          {['English', 'Japanese', 'French', 'German', 'Italian', 'Spanish', 'Other'].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>

        <label className="checkline">
          <input
            type="checkbox"
            checked={filter.gradedOnly}
            onChange={(e) => apply({ ...filter, gradedOnly: e.target.checked })}
          />
          Graded cards only
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={filter.sellerHasReviews}
            onChange={(e) => apply({ ...filter, sellerHasReviews: e.target.checked })}
          />
          Seller has reviews
        </label>
      </aside>

      <section className="browse-main">
        <div className="browse-toolbar">
          <h1 className="display browse-title">Browse cards</h1>
          <div className="mono-label">
            {String(total).padStart(2, '0')} result{total === 1 ? '' : 's'}
          </div>
          <div className="browse-search">
            <span aria-hidden="true" className="browse-search-icon">⌕</span>
            <input
              ref={searchRef}
              type="search"
              aria-label="Search cards"
              placeholder="Search card name, set or title"
              className="input-round browse-search-input"
              value={searchDraft}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="browse-sorts">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className="pill"
                aria-pressed={filter.sort === s.key}
                onClick={() => apply({ ...filter, sort: s.key })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {state === 'loading' && (
          <div className="browse-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton browse-skel" />
            ))}
          </div>
        )}

        {state === 'error' && (
          <div className="empty-dashed" role="alert">
            <h3>Couldn&apos;t load listings</h3>
            <p>Something went wrong fetching the marketplace.</p>
            <button className="btn-acid" onClick={() => void runSearch(0)}>
              Retry
            </button>
          </div>
        )}

        {state === 'ready' && items.length === 0 && (
          <div className="empty-dashed">
            <h3>No cards match these filters</h3>
            <p>Try widening the price range or clearing the search.</p>
            <button className="btn-acid" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {state === 'ready' && items.length > 0 && (
          <>
            <div className="browse-grid">
              {items.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            {hasMore && (
              <div className="browse-more">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={loadingMore}
                  onClick={() => void runSearch(items.length)}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
