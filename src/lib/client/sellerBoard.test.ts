import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient } from './MockClient';


// MockClient is browser-shaped: it remembers the signed-in user in
// sessionStorage and syncs tabs over BroadcastChannel. Under the node test
// environment we give it a session store and no channel (the guard in the
// constructor then skips cross-tab sync entirely).
const session = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => void session.set(k, v),
  removeItem: (k: string) => void session.delete(k),
});
vi.stubGlobal('BroadcastChannel', undefined);

// Mock listing images are drawn on a canvas, which the client touches
// whenever it emits a listing. Node has no DOM, so a no-op 2D context is
// enough — these tests assert rules, never pixels.
const gradient = { addColorStop: () => undefined };
const context2d = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (typeof prop === 'string' && prop.startsWith('create')) return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      return () => undefined;
    },
    set: () => true,
  },
);
vi.stubGlobal('document', {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => context2d,
    toDataURL: () => 'data:image/png;base64,stub',
  }),
});

// Seeded ids (src/mock/seed.ts): u-admin moderates.
const ADMIN = 'u-admin';
const KARIM = 'u-karim';
const MAYA = 'u-maya';

let client: MockClient;
const signIn = (id: string) => client.signInAsMockUser(id);
const authSettled = (c: MockClient) =>
  new Promise<void>((resolve) => {
    const stop = c.onAuthChange((state) => {
      if (!state.loading) {
        stop();
        resolve();
      }
    });
  });

beforeEach(async () => {
  session.clear();
  client = new MockClient();
  await authSettled(client);
  await signIn(KARIM);
});

const input = {
  title: 'Charizard',
  game: 'pokemon' as const,
  setName: 'Base Set',
  cardNumber: '4/102',
  language: 'English',
  condition: 'NM' as const,
  finish: 'normal' as const,
  gradeCompany: null,
  gradeValue: null,
  price: 10,
  currency: 'USD',
  quantity: 1,
  description: '',
};
const photo = { id: 'd1', kind: 'new' as const, url: 'data:image/png;base64,p1' };

describe('seller board (home Top sellers, /sellers)', () => {
  it('leaves out a seller whose only listing is still in review, for every viewer', async () => {
    // A seeded member who is not on the board yet (no approved listing, no review).
    const board = await client.listSellers(100);
    const onBoard = new Set(board.map((s) => s.profile.id));
    const newcomer = ['u-lina', 'u-nabil', 'u-rita', MAYA].find((id) => !onBoard.has(id));
    expect(newcomer).toBeDefined();

    await signIn(newcomer!);
    const listing = await client.createListing(input, [photo]);
    expect(listing.reviewState).toBe('pending');

    // the seller themselves, an admin (who reads every listing) and another member
    for (const viewer of [newcomer!, ADMIN, KARIM]) {
      await signIn(viewer);
      const sellers = await client.listSellers(100);
      expect(sellers.map((s) => s.profile.id)).not.toContain(newcomer);
      expect(sellers.every((s, i) => s.rank === i + 1)).toBe(true);
    }
  });
});
