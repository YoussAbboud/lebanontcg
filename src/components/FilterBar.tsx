import { useEffect, useRef, useState } from 'react';
import type { ListingFilter } from '../lib/types';
import {
  CONDITIONS,
  CONDITION_LABELS,
  FINISHES,
  FINISH_LABELS,
  GAMES,
  GAME_LABELS,
} from '../lib/types';
import { activeFacetCount, DEFAULT_FILTER } from '../lib/filter';
import './filterbar.css';

interface Props {
  filter: ListingFilter;
  onChange(next: ListingFilter): void;
}

/** Search, game chips, a filters popover, and sort — writes URL state via onChange. */
export function FilterBar({ filter, onChange }: Props) {
  const [searchDraft, setSearchDraft] = useState(filter.q);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Keep the input in sync when the URL changes externally (back/forward).
  useEffect(() => setSearchDraft(filter.q), [filter.q]);

  useEffect(() => {
    if (!panelOpen) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [panelOpen]);

  const setSearch = (value: string) => {
    setSearchDraft(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onChange({ ...filter, q: value });
    }, 300);
  };

  const toggleGame = (game: (typeof GAMES)[number]) => {
    const games = filter.games.includes(game)
      ? filter.games.filter((g) => g !== game)
      : [...filter.games, game];
    onChange({ ...filter, games });
  };

  const facets = activeFacetCount(filter);

  return (
    <div className="fbar">
      <div className="fbar-row">
        <div className="fbar-search">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="fbar-search-icon">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
          </svg>
          <input
            type="search"
            className="input fbar-search-input"
            placeholder="Search cards or sets…"
            value={searchDraft}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search cards or sets"
          />
        </div>

        <div className="fbar-panel-wrap" ref={panelRef}>
          <button
            className="chip fbar-filters-btn"
            aria-expanded={panelOpen}
            aria-pressed={facets > 0}
            onClick={() => setPanelOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            Filters{facets > 0 ? ` (${facets})` : ''}
          </button>

          {panelOpen && (
            <div className="fbar-panel glass" role="group" aria-label="Filters">
              <fieldset className="fbar-group">
                <legend className="field-label">Condition</legend>
                <div className="fbar-chips">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c}
                      className="chip"
                      aria-pressed={filter.conditions.includes(c)}
                      title={CONDITION_LABELS[c]}
                      onClick={() =>
                        onChange({
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
              </fieldset>

              <fieldset className="fbar-group">
                <legend className="field-label">Finish</legend>
                <div className="fbar-chips">
                  {FINISHES.map((f) => (
                    <button
                      key={f}
                      className="chip"
                      aria-pressed={filter.finishes.includes(f)}
                      onClick={() =>
                        onChange({
                          ...filter,
                          finishes: filter.finishes.includes(f)
                            ? filter.finishes.filter((x) => x !== f)
                            : [...filter.finishes, f],
                        })
                      }
                    >
                      {FINISH_LABELS[f]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="fbar-group fbar-price">
                <span className="field-label" id="price-range-label">Price (USD)</span>
                <div className="fbar-price-inputs" role="group" aria-labelledby="price-range-label">
                  <input
                    type="number"
                    className="input"
                    placeholder="Min"
                    min="0"
                    inputMode="numeric"
                    aria-label="Minimum price"
                    value={filter.priceMin ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...filter,
                        priceMin: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="number"
                    className="input"
                    placeholder="Max"
                    min="0"
                    inputMode="numeric"
                    aria-label="Maximum price"
                    value={filter.priceMax ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...filter,
                        priceMax: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </div>
              </div>

              <div className="fbar-group fbar-switches">
                <label className="fbar-check">
                  <input
                    type="checkbox"
                    checked={filter.gradedOnly}
                    onChange={(e) => onChange({ ...filter, gradedOnly: e.target.checked })}
                  />
                  Graded cards only
                </label>
                <label className="fbar-check fbar-lang">
                  <span className="field-label">Language</span>
                  <select
                    className="select"
                    value={filter.language ?? ''}
                    onChange={(e) => onChange({ ...filter, language: e.target.value || null })}
                  >
                    <option value="">Any</option>
                    <option>English</option>
                    <option>Japanese</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Italian</option>
                    <option>Spanish</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>

              <button
                className="btn btn-quiet btn-sm fbar-clear"
                disabled={facets === 0 && !filter.q}
                onClick={() => {
                  onChange({ ...DEFAULT_FILTER, sort: filter.sort });
                  setPanelOpen(false);
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        <label className="fbar-sort">
          <span className="visually-hidden">Sort listings</span>
          <select
            className="select"
            value={filter.sort}
            onChange={(e) => onChange({ ...filter, sort: e.target.value as ListingFilter['sort'] })}
          >
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <div className="fbar-games" role="group" aria-label="Filter by game">
        <button
          className="chip"
          aria-pressed={filter.games.length === 0}
          onClick={() => onChange({ ...filter, games: [] })}
        >
          All games
        </button>
        {GAMES.map((g) => (
          <button key={g} className="chip" aria-pressed={filter.games.includes(g)} onClick={() => toggleGame(g)}>
            <span className="game-dot" data-game={g} aria-hidden="true" />
            {GAME_LABELS[g]}
          </button>
        ))}
      </div>
    </div>
  );
}
