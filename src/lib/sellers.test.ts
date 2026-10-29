import { describe, expect, it } from 'vitest';
import { rankablePool } from './sellers';
import type { SellerStats } from './types';

const seller = (id: string, activeCount: number, soldCount: number, ratingCount: number, rank: number) =>
  ({ profile: { id, ratingCount }, rank, activeCount, soldCount, games: [] }) as unknown as SellerStats;

describe('rankablePool', () => {
  it('drops sellers with nothing public and renumbers the rest', () => {
    const out = rankablePool([
      seller('a', 3, 0, 2, 1),
      seller('pending-only', 0, 0, 0, 2),
      seller('sold', 0, 1, 0, 3),
      seller('reviewed', 0, 0, 1, 4),
    ]);
    expect(out.map((s) => [s.profile.id, s.rank])).toEqual([
      ['a', 1],
      ['sold', 2],
      ['reviewed', 3],
    ]);
  });
});
