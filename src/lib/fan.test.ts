import { describe, expect, it } from 'vitest';
import { fanInitialActive, fanInitialWindow } from './fan';

describe('fanInitialWindow', () => {
  it('is everything when the list fits on screen', () => {
    expect(fanInitialWindow([])).toEqual([]);
    expect(fanInitialWindow(['a'])).toEqual(['a']);
    expect(fanInitialWindow([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('is the seven around the opening card, wrapping past the start', () => {
    const items = Array.from({ length: 15 }, (_, i) => i);
    expect(fanInitialActive(15)).toBe(2);
    // centre 2, three to each side: 14 wraps in from the end
    expect(fanInitialWindow(items)).toEqual([0, 1, 2, 3, 4, 5, 14]);
  });
});
