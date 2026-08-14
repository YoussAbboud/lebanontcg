import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, statusChangeSystemMessage } from './status';
import type { ListingStatus } from './types';

describe('listing status transitions', () => {
  it('active can reserve, sell, or remove', () => {
    expect(allowedTransitions('active').sort()).toEqual(['removed', 'reserved', 'sold'].sort());
  });

  it('reserved can go back to active, sell, or remove', () => {
    expect(allowedTransitions('reserved').sort()).toEqual(['active', 'removed', 'sold'].sort());
  });

  it('sold is terminal', () => {
    expect(allowedTransitions('sold')).toEqual([]);
    for (const to of ['active', 'reserved', 'removed'] as ListingStatus[]) {
      expect(canTransition('sold', to)).toBe(false);
    }
  });

  it('removed can only be relisted', () => {
    expect(allowedTransitions('removed')).toEqual(['active']);
    expect(canTransition('removed', 'sold')).toBe(false);
    expect(canTransition('removed', 'reserved')).toBe(false);
  });

  it('no self transitions are declared', () => {
    for (const s of ['active', 'reserved', 'sold', 'removed'] as ListingStatus[]) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe('status change system messages', () => {
  it('distinguishes reserved-for-this-conversation', () => {
    expect(statusChangeSystemMessage('reserved', true)).toMatch(/for this conversation/);
    expect(statusChangeSystemMessage('reserved', false)).toMatch(/as reserved/);
  });

  it('covers every status', () => {
    for (const s of ['active', 'reserved', 'sold', 'removed'] as ListingStatus[]) {
      expect(statusChangeSystemMessage(s, false)).toBeTruthy();
    }
  });
});
