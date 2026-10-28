import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient } from './MockClient';
import { formatWait } from '../format';

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

describe('suspension', () => {
  it('locks every action at once and tells the member', async () => {
    const conv = (await client.listConversations())[0];
    const listing = (await client.getListingsBySeller(MAYA, ['active']))[0];

    await signIn(ADMIN);
    await client.adminSetSuspended(KARIM, true, 'Spam');
    await signIn(KARIM);
    expect(client.getAuthState().user?.suspendedAt).not.toBeNull();

    const suspended = /suspended/i;
    await expect(client.sendMessage(conv.id, 'hello', 'c1')).rejects.toThrow(suspended);
    await expect(client.sharePhone(conv.id, '+96170123456', 'c2')).rejects.toThrow(suspended);
    await expect(client.setFavorite(listing.id, true)).rejects.toThrow(suspended);
    await expect(
      client.submitReport({ targetType: 'listing', targetId: listing.id, reason: 'spam', detail: '' }),
    ).rejects.toThrow(suspended);
    await expect(client.setBlocked(MAYA, true)).rejects.toThrow(suspended);
    await expect(client.updateProfile({ bio: 'hi' })).rejects.toThrow(suspended);
    await expect(client.openConversation(listing.id)).rejects.toThrow(suspended);

    // Reading and support still work — that is how they appeal.
    expect((await client.getMessages(conv.id)).length).toBeGreaterThan(0);
    expect(await client.openSupportTicket('Appeal', 'appeal', 'Please look again')).toBeTruthy();
    expect((await client.listNotifications(10)).some((n) => n.title === 'Your account is suspended')).toBe(true);

    await signIn(ADMIN);
    await client.adminSetSuspended(KARIM, false, '');
    await signIn(KARIM);
    expect((await client.listNotifications(10)).some((n) => n.title === 'Your suspension was lifted')).toBe(true);
    await client.setFavorite(listing.id, true);
  });

  it('a third warning suspends with a single notice', async () => {
    await signIn(ADMIN);
    for (const r of ['One', 'Two', 'Three']) await client.adminWarnUser(KARIM, r);
    await signIn(KARIM);
    const notes = await client.listNotifications(20);
    expect(notes.filter((n) => n.title === 'Your account is suspended').length).toBe(1);
  });
});

describe('listing cooldown', () => {
  it('two flagged listings in a row pause listing for ten minutes', async () => {
    expect(await client.getListingCooldown()).toBe(0);
    const a = await client.createListing(input('junk one'), [photo(1)]);
    await client.screenListing(a.id);
    expect(await client.getListingCooldown()).toBe(0);
    const b = await client.createListing(input('junk two'), [photo(2)]);
    await client.screenListing(b.id);

    const left = await client.getListingCooldown();
    expect(left).toBeGreaterThan(590);
    expect(left).toBeLessThanOrEqual(600);
    await expect(client.createListing(input('Charizard'), [photo(3)])).rejects.toThrow(
      /can't list at the moment\. Try again in (10 minutes|9 minutes \d+ seconds?)\./,
    );
    // New photos on an existing listing are listing too.
    const live = (await client.getListingsBySeller(KARIM, ['active']))[0];
    await expect(client.updateListing(live.id, input(live.title), [photo(4)])).rejects.toThrow(
      /can't list/,
    );

    // A moderator approving one of them takes that flag back.
    await signIn(ADMIN);
    await client.adminReviewListing(b.id, true, 'Fine after all');
    await signIn(KARIM);
    expect(await client.getListingCooldown()).toBe(0);
  });

  it('a good listing in between breaks the run', async () => {
    const a = await client.createListing(input('junk one'), [photo(1)]);
    await client.screenListing(a.id);
    const ok = await client.createListing(input('Mewtwo'), [photo(2)]);
    await client.screenListing(ok.id);
    // ...but two flags within five minutes still count.
    const b = await client.createListing(input('junk two'), [photo(3)]);
    await client.screenListing(b.id);
    expect(await client.getListingCooldown()).toBeGreaterThan(0);
  });
});

describe('formatWait', () => {
  it('reads like the database says it', () => {
    expect(formatWait(539)).toBe('8 minutes 59 seconds');
    expect(formatWait(60)).toBe('1 minute');
    expect(formatWait(61)).toBe('1 minute 1 second');
    expect(formatWait(9)).toBe('9 seconds');
    expect(formatWait(0.2)).toBe('1 second');
  });
});
