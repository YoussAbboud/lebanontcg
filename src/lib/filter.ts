import type { Condition, Finish, Game, Listing, ListingFilter } from './types';
import { CONDITIONS, FINISHES, GAMES } from './types';

export const DEFAULT_FILTER: ListingFilter = {
  q: '',
  games: [],
  conditions: [],
  finishes: [],
  priceMin: null,
  priceMax: null,
  gradedOnly: false,
  sellerHasReviews: false,
  hasPregrade: false,
  language: null,
  sort: 'newest',
};

export function isDefaultFilter(f: ListingFilter): boolean {
  return (
    !f.q &&
    f.games.length === 0 &&
    f.conditions.length === 0 &&
    f.finishes.length === 0 &&
    f.priceMin === null &&
    f.priceMax === null &&
    !f.gradedOnly &&
    !f.sellerHasReviews &&
    !f.hasPregrade &&
    !f.language &&
    f.sort === 'newest'
  );
}

/** Count of non-default filter facets (for the "Filters (n)" chip). */
export function activeFacetCount(f: ListingFilter): number {
  let n = 0;
  if (f.games.length) n++;
  if (f.conditions.length) n++;
  if (f.finishes.length) n++;
  if (f.priceMin !== null || f.priceMax !== null) n++;
  if (f.gradedOnly) n++;
  if (f.sellerHasReviews) n++;
  if (f.hasPregrade) n++;
  if (f.language) n++;
  return n;
}

/** Predicate applied by MockClient; mirrors the SQL built for Supabase. */
export function listingMatchesFilter(l: Listing, f: ListingFilter): boolean {
  if (l.status !== 'active') return false;
  if (f.games.length && !f.games.includes(l.game)) return false;
  if (f.conditions.length && !f.conditions.includes(l.condition)) return false;
  if (f.finishes.length && !f.finishes.includes(l.finish)) return false;
  if (f.priceMin !== null && l.price < f.priceMin) return false;
  if (f.priceMax !== null && l.price > f.priceMax) return false;
  if (f.gradedOnly && !l.gradeValue) return false;
  if (f.language && l.language.toLowerCase() !== f.language.toLowerCase()) return false;
  if (f.q) {
    const hay = `${l.title} ${l.setName}`.toLowerCase();
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.every((t) => hay.includes(t))) return false;
  }
  return true;
}

/** Sorts everything except most_watched (which needs like counts — the
    clients handle it where the counts live). */
export function sortListings<T extends Listing>(items: T[], sort: ListingFilter['sort']): T[] {
  const out = [...items];
  switch (sort) {
    case 'price_asc':
      out.sort((a, b) => a.price - b.price || cmpNewest(a, b));
      break;
    case 'price_desc':
      out.sort((a, b) => b.price - a.price || cmpNewest(a, b));
      break;
    default:
      out.sort(cmpNewest);
      break;
  }
  return out;
}

function cmpNewest(a: Listing, b: Listing): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

// ---- URL state (shareable filter links) -----------------------------------

export function filterToSearchParams(f: ListingFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.games.length) p.set('games', f.games.join(','));
  if (f.conditions.length) p.set('cond', f.conditions.join(','));
  if (f.finishes.length) p.set('finish', f.finishes.join(','));
  if (f.priceMin !== null) p.set('min', String(f.priceMin));
  if (f.priceMax !== null) p.set('max', String(f.priceMax));
  if (f.gradedOnly) p.set('graded', '1');
  if (f.sellerHasReviews) p.set('rated', '1');
  if (f.hasPregrade) p.set('pregrade', '1');
  if (f.language) p.set('lang', f.language);
  if (f.sort !== 'newest') p.set('sort', f.sort);
  return p;
}

export function filterFromSearchParams(p: URLSearchParams): ListingFilter {
  const csv = <T extends string>(key: string, valid: readonly T[]): T[] =>
    (p.get(key) ?? '')
      .split(',')
      .filter((v): v is T => (valid as readonly string[]).includes(v));
  const num = (key: string): number | null => {
    const raw = p.get(key);
    if (raw === null || raw === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  const sortRaw = p.get('sort');
  return {
    q: p.get('q') ?? '',
    games: csv('games', GAMES) as Game[],
    conditions: csv('cond', CONDITIONS) as Condition[],
    finishes: csv('finish', FINISHES) as Finish[],
    priceMin: num('min'),
    priceMax: num('max'),
    gradedOnly: p.get('graded') === '1',
    sellerHasReviews: p.get('rated') === '1',
    hasPregrade: p.get('pregrade') === '1',
    language: p.get('lang') || null,
    sort:
      sortRaw === 'price_asc' || sortRaw === 'price_desc' || sortRaw === 'most_watched'
        ? sortRaw
        : 'newest',
  };
}
