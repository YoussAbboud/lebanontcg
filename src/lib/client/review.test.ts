import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient } from './MockClient';
import { DEFAULT_FILTER } from '../filter';

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

const input = (title: string) => ({
  title,
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
});
const photo = (n: number) => ({ id: `d${n}`, kind: 'new' as const, url: `data:image/png;base64,p${n}` });

describe('listing review', () => {
  it('a new listing is hidden until the photo check passes', async () => {
    const listing = await client.createListing(input('Charizard'), [photo(1)]);
    expect(listing.reviewState).toBe('pending');

    await signIn(MAYA);
    expect(await client.getListing(listing.id)).toBeNull();
    await expect(client.openConversation(listing.id)).rejects.toThrow(/waiting for review/i);
    await expect(client.setFavorite(listing.id, true)).rejects.toThrow(/waiting for review/i);

    await signIn(KARIM);
    expect((await client.getListing(listing.id))?.reviewState).toBe('pending');
    expect(await client.screenListing(listing.id)).toBe('approved');

    await signIn(MAYA);
    expect((await client.getListing(listing.id))?.reviewState).toBe('approved');
    const page = await client.searchListings({ ...DEFAULT_FILTER, q: 'Charizard' }, 0, 50);
    expect(page.items.some((l) => l.id === listing.id)).toBe(true);
  });

  it('junk waits for a moderator, who can reject it with a reason the seller sees', async () => {
    const listing = await client.createListing(input('junk lol'), [photo(1)]);
    expect(await client.screenListing(listing.id)).toBe('pending');

    await signIn(MAYA);
    await expect(client.adminListReviewQueue()).rejects.toThrow(/restricted to admins/i);

    await signIn(ADMIN);
    expect((await client.getAdminStats()).listingsPending).toBe(1);
    const queue = await client.adminListReviewQueue();
    expect(queue.map((q) => q.listing.id)).toEqual([listing.id]);
    expect(queue[0].screens[0].verdict).toBe('not_card');
    expect((await client.listNotifications(10)).some((n) => n.title === 'Listing waiting for review')).toBe(true);

    await expect(client.adminReviewListing(listing.id, false, '')).rejects.toThrow(/reason is required/i);
    await client.adminReviewListing(listing.id, false, 'Not a trading card');
    expect(await client.adminListReviewQueue()).toEqual([]);
    expect((await client.adminListActions(5))[0].kind).toBe('listing_reject');

    await signIn(KARIM);
    const mine = await client.getListing(listing.id);
    expect(mine?.reviewState).toBe('rejected');
    expect(mine?.reviewNote).toBe('Not a trading card');
    expect((await client.listNotifications(10)).some((n) => /wasn't approved/.test(n.title))).toBe(true);

    // New photos send it back to the queue; a passing check can't overrule the moderator.
    await client.updateListing(listing.id, input('Real card now'), [photo(2)]);
    expect(await client.screenListing(listing.id)).toBe('pending');

    await signIn(ADMIN);
    await client.adminReviewListing(listing.id, true, '');
    await signIn(MAYA);
    expect((await client.getListing(listing.id))?.reviewState).toBe('approved');
  });

  it('new photos on a live listing send it back for a check', async () => {
    const listing = await client.createListing(input('Blastoise'), [photo(1)]);
    await client.screenListing(listing.id);
    const live = (await client.getListing(listing.id))!;
    const kept = live.images.map((img) => ({ id: img.id, kind: 'existing' as const, url: img.url }));

    const edited = await client.updateListing(listing.id, input('Blastoise'), kept);
    expect(edited.reviewState).toBe('approved');
    const repictured = await client.updateListing(listing.id, input('Blastoise'), [...kept, photo(3)]);
    expect(repictured.reviewState).toBe('pending');
  });
});
