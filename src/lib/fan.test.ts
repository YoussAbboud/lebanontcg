import { describe, expect, it } from 'vitest';
import { fanInitialActive } from './fan';

describe('fanInitialActive', () => {
  it('opens on the third card, or the last one when there are fewer', () => {
    expect(fanInitialActive(0)).toBe(0);
    expect(fanInitialActive(1)).toBe(0);
    expect(fanInitialActive(2)).toBe(1);
    expect(fanInitialActive(15)).toBe(2);
  });
});
