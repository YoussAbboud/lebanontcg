import { describe, expect, it } from 'vitest';
import {
  activeFacetCount,
  DEFAULT_FILTER,
  filterFromSearchParams,
  filterToSearchParams,
  isDefaultFilter,
  listingMatchesFilter,
  sortListings,
} from './filter';
import type { Listing, ListingFilter } from './types';

const base = (over: Partial<Listing> = {}): Listing => ({
  id: 'l-1',
  sellerId: 'u-1',
  title: 'Charizard Base Set',
  game: 'pokemon',
  setName: 'Base Set',
  cardNumber: '4/102',
  language: 'English',
  condition: 'LP',
  finish: 'holo',
  gradeCompany: null,
  gradeValue: null,
  price: 100,
  currency: 'USD',
  quantity: 1,
  description: '',
  status: 'active',
  saleType: 'fixed',
  reservedForConversationId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  images: [],
  ...over,
});

const f = (over: Partial<ListingFilter> = {}): ListingFilter => ({ ...DEFAULT_FILTER, ...over });

describe('listingMatchesFilter', () => {
  it('only matches active listings', () => {
    expect(listingMatchesFilter(base(), f())).toBe(true);
    for (const status of ['reserved', 'sold', 'removed'] as const) {
      expect(listingMatchesFilter(base({ status }), f())).toBe(false);
    }
  });

  it('filters by game, condition, finish', () => {
    expect(listingMatchesFilter(base(), f({ games: ['pokemon'] }))).toBe(true);
    expect(listingMatchesFilter(base(), f({ games: ['magic'] }))).toBe(false);
    expect(listingMatchesFilter(base(), f({ conditions: ['LP', 'NM'] }))).toBe(true);
    expect(listingMatchesFilter(base(), f({ conditions: ['DMG'] }))).toBe(false);
    expect(listingMatchesFilter(base(), f({ finishes: ['holo'] }))).toBe(true);
    expect(listingMatchesFilter(base(), f({ finishes: ['normal'] }))).toBe(false);
  });

  it('applies inclusive price bounds', () => {
    expect(listingMatchesFilter(base({ price: 100 }), f({ priceMin: 100, priceMax: 100 }))).toBe(true);
    expect(listingMatchesFilter(base({ price: 99.99 }), f({ priceMin: 100 }))).toBe(false);
    expect(listingMatchesFilter(base({ price: 100.01 }), f({ priceMax: 100 }))).toBe(false);
  });

  it('graded-only requires a grade value', () => {
    expect(listingMatchesFilter(base(), f({ gradedOnly: true }))).toBe(false);
    expect(
      listingMatchesFilter(base({ gradeCompany: 'PSA', gradeValue: 'PSA 9' }), f({ gradedOnly: true })),
    ).toBe(true);
  });

  it('language matches case-insensitively', () => {
    expect(listingMatchesFilter(base(), f({ language: 'english' }))).toBe(true);
    expect(listingMatchesFilter(base(), f({ language: 'Japanese' }))).toBe(false);
  });

  it('search terms AND across title + set name', () => {
    expect(listingMatchesFilter(base(), f({ q: 'char' }))).toBe(true);
    expect(listingMatchesFilter(base(), f({ q: 'charizard base' }))).toBe(true);
    expect(listingMatchesFilter(base(), f({ q: 'charizard shadowless' }))).toBe(false);
    // term in set name only
    expect(listingMatchesFilter(base(), f({ q: 'set' }))).toBe(true);
  });
});

describe('sortListings', () => {
  const items = [
    base({ id: 'a', price: 50, createdAt: '2026-01-03T00:00:00Z' }),
    base({ id: 'b', price: 20, createdAt: '2026-01-01T00:00:00Z' }),
    base({ id: 'c', price: 50, createdAt: '2026-01-02T00:00:00Z' }),
  ];

  it('newest first', () => {
    expect(sortListings(items, 'newest').map((l) => l.id)).toEqual(['a', 'c', 'b']);
  });

  it('price ascending with newest tiebreak', () => {
    expect(sortListings(items, 'price_asc').map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });

  it('price descending', () => {
    expect(sortListings(items, 'price_desc').map((l) => l.id)).toEqual(['a', 'c', 'b']);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    sortListings(items, 'price_asc');
    expect(items).toEqual(copy);
  });
});

describe('URL round-trip', () => {
  it('serializes only non-default fields', () => {
    expect(filterToSearchParams(f()).toString()).toBe('');
    const params = filterToSearchParams(
      f({ q: 'zard', games: ['pokemon', 'magic'], priceMin: 10, gradedOnly: true, sort: 'price_asc' }),
    );
    expect(params.get('q')).toBe('zard');
    expect(params.get('games')).toBe('pokemon,magic');
    expect(params.get('min')).toBe('10');
    expect(params.get('graded')).toBe('1');
    expect(params.get('sort')).toBe('price_asc');
    expect(params.get('max')).toBeNull();
  });

  it('round-trips every facet', () => {
    const original = f({
      q: 'blue eyes',
      games: ['yugioh'],
      conditions: ['MP', 'HP'],
      finishes: ['holo'],
      priceMin: 5,
      priceMax: 600,
      gradedOnly: true,
      language: 'Japanese',
      sort: 'price_desc',
    });
    expect(filterFromSearchParams(filterToSearchParams(original))).toEqual(original);
  });

  it('drops invalid values instead of crashing', () => {
    const params = new URLSearchParams('games=pokemon,notagame&cond=NM,XX&min=-5&max=abc&sort=bogus');
    const parsed = filterFromSearchParams(params);
    expect(parsed.games).toEqual(['pokemon']);
    expect(parsed.conditions).toEqual(['NM']);
    expect(parsed.priceMin).toBeNull();
    expect(parsed.priceMax).toBeNull();
    expect(parsed.sort).toBe('newest');
  });

  it('facet count and default detection agree', () => {
    expect(isDefaultFilter(f())).toBe(true);
    expect(activeFacetCount(f())).toBe(0);
    const busy = f({ games: ['magic'], priceMin: 1, gradedOnly: true });
    expect(isDefaultFilter(busy)).toBe(false);
    expect(activeFacetCount(busy)).toBe(3);
  });
});
