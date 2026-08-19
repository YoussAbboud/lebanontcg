import { describe, expect, it } from 'vitest';
import { formatTimeLeft, isEndingSoon, minNextBid } from './auction';

describe('minNextBid (mirror of public.min_next_bid)', () => {
  it('first bid may equal the starting price', () => {
    expect(minNextBid(null, 10)).toBe(10);
  });
  it('5% rounded up, floor of 1 unit', () => {
    expect(minNextBid(10, 10)).toBe(11); // 5% = 0.5 → floor 1
    expect(minNextBid(19, 10)).toBe(20); // 0.95 → 1
    expect(minNextBid(20, 10)).toBe(21); // exactly 1
    expect(minNextBid(21, 10)).toBe(23); // 1.05 → ceil 2
    expect(minNextBid(100, 10)).toBe(105);
    expect(minNextBid(101, 10)).toBe(107); // 5.05 → 6
  });
});

describe('countdown copy', () => {
  const at = (ms: number) => new Date(1_000_000_000_000 + ms).toISOString();
  const now = 1_000_000_000_000;
  it('coarse above five minutes, seconds under it', () => {
    expect(formatTimeLeft(at(2 * 86400_000 + 4 * 3600_000), now)).toBe('2d 4h');
    expect(formatTimeLeft(at(2 * 3600_000 + 14 * 60_000), now)).toBe('2h 14m');
    expect(formatTimeLeft(at(14 * 60_000), now)).toBe('14m');
    expect(formatTimeLeft(at(4 * 60_000 + 32_000), now)).toBe('4m 32s');
    expect(formatTimeLeft(at(48_000), now)).toBe('48s');
    expect(formatTimeLeft(at(0), now)).toBe('Ended');
  });
  it('ending-soon threshold is five minutes', () => {
    expect(isEndingSoon(at(4 * 60_000), now)).toBe(true);
    expect(isEndingSoon(at(6 * 60_000), now)).toBe(false);
    expect(isEndingSoon(at(0), now)).toBe(false);
  });
});
