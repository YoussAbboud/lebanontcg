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

// Seeded ids (src/mock/seed.ts): Maya subscribes, Lina bought a pack,
// Karim is a free seller, u-admin moderates.
const ADMIN = 'u-admin';
const MAYA = 'u-maya';
const KARIM = 'u-karim';
const LINA = 'u-lina';

let client: MockClient;

const signIn = (id: string) => client.signInAsMockUser(id);

/** The constructor restores the session asynchronously; signing in before
    that lands would be overwritten by the restore. */
const authSettled = (c: MockClient) =>
  new Promise<void>((resolve) => {
    const stop = c.onAuthChange((state) => {
      if (!state.loading) {
        stop();
        resolve();
      }
    });
  });

const listingInput = (title: string) => ({
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

/** A fresh account: nobody's seeded listings, nobody's seeded plan. */
const newSeller = async () => {
  await client.signUpWithPassword(`seller${Math.random().toString(36).slice(2, 8)}@plan.dev`, 'hunter2hunter2');
};

beforeEach(async () => {
  session.clear();
  client = new MockClient();
  await authSettled(client);
});

describe('the free listing allowance', () => {
  it('gives a new seller three listings, then stops', async () => {
    await newSeller();
    const before = await client.getEntitlements();
    expect(before).toMatchObject({
      subscribed: false,
      freeAllowance: 3,
      listingsCreated: 0,
      creditsRemaining: 0,
      canCreateListing: true,
      canUsePregrade: false,
    });

    for (const n of [1, 2, 3]) await client.createListing(listingInput(`Card ${n}`), []);

    const after = await client.getEntitlements();
    expect(after?.listingsCreated).toBe(3);
    expect(after?.canCreateListing).toBe(false);
    await expect(client.createListing(listingInput('Card 4'), [])).rejects.toThrow(
      /listing limit reached/i,
    );
  });

  it('does not hand the slot back when a listing is removed', async () => {
    await newSeller();
    const made = [];
    for (const n of [1, 2, 3]) made.push(await client.createListing(listingInput(`Card ${n}`), []));
    await client.setListingStatus(made[0].id, 'removed');
    const e = await client.getEntitlements();
    expect(e?.listingsCreated).toBe(3);
    expect(e?.canCreateListing).toBe(false);
  });
});

describe('bought listings', () => {
  it('asks, waits, then spends what an admin switched on', async () => {
    await newSeller();
    for (const n of [1, 2, 3]) await client.createListing(listingInput(`Card ${n}`), []);
    const me = client.getAuthState().user!.id;

    await client.requestPurchase('credits_5', 'OMT 12345');
    const pending = await client.getEntitlements();
    expect(pending?.pendingRequests).toBe(1);
    // A request on its own grants nothing.
    expect(pending?.creditsRemaining).toBe(0);
    expect(pending?.canCreateListing).toBe(false);

    await signIn(ADMIN);
    const queue = await client.adminListPurchases('pending');
    const mine = queue.find((r) => r.userId === me && r.kind === 'credits');
    expect(mine).toBeTruthy();
    expect(mine?.note).toBe('OMT 12345');
    expect(mine?.priceUsd).toBe(5);
    await client.adminReviewPurchase('credits', mine!.id, true, 'payment confirmed');

    await signIn(me);
    const live = await client.getEntitlements();
    expect(live?.creditsRemaining).toBe(5);
    expect(live?.canCreateListing).toBe(true);

    for (const n of [4, 5, 6, 7, 8]) await client.createListing(listingInput(`Card ${n}`), []);
    const spent = await client.getEntitlements();
    expect(spent?.creditsRemaining).toBe(0);
    await expect(client.createListing(listingInput('Card 9'), [])).rejects.toThrow(
      /listing limit reached/i,
    );
  });

  it('rejecting a request grants nothing and clears the queue', async () => {
    await newSeller();
    const me = client.getAuthState().user!.id;
    await client.requestPurchase('credits_15', 'bad transfer');

    await signIn(ADMIN);
    const row = (await client.adminListPurchases('pending')).find((r) => r.userId === me)!;
    await client.adminReviewPurchase('credits', row.id, false, 'no payment found');

    await signIn(me);
    const e = await client.getEntitlements();
    expect(e?.creditsRemaining).toBe(0);
    expect(e?.pendingRequests).toBe(0);
  });

  it('spends the oldest pack first', async () => {
    await newSeller();
    const me = client.getAuthState().user!.id;
    for (const n of [1, 2, 3]) await client.createListing(listingInput(`Card ${n}`), []);

    await signIn(ADMIN);
    await client.adminGrantCredits(me, 2, 'first pack');
    await client.adminGrantCredits(me, 4, 'second pack');

    await signIn(me);
    expect((await client.getEntitlements())?.creditsRemaining).toBe(6);
    for (const n of [4, 5, 6] as const) await client.createListing(listingInput(`Card ${n}`), []);
    // Three listings drain the 2-pack, then one off the 4-pack.
    expect((await client.getEntitlements())?.creditsRemaining).toBe(3);
  });
});

describe('subscriptions', () => {
  it('lifts the listing limit and unlocks Pre-Grade', async () => {
    await newSeller();
    const me = client.getAuthState().user!.id;
    for (const n of [1, 2, 3]) await client.createListing(listingInput(`Card ${n}`), []);
    await client.requestPurchase('monthly', 'Whish');
    await expect(client.requestPurchase('monthly', 'again')).rejects.toThrow(/already have/i);

    await signIn(ADMIN);
    const row = (await client.adminListPurchases('pending')).find(
      (r) => r.userId === me && r.kind === 'subscription',
    )!;
    await client.adminReviewPurchase('subscription', row.id, true, '');

    await signIn(me);
    const e = await client.getEntitlements();
    expect(e?.subscribed).toBe(true);
    expect(e?.tier).toBe('monthly');
    expect(e?.canUsePregrade).toBe(true);
    for (const n of [4, 5, 6, 7, 8, 9] as const) {
      await client.createListing(listingInput(`Card ${n}`), []);
    }
    expect((await client.getEntitlements())?.canCreateListing).toBe(true);
    // Subscribers never touch credits.
    expect((await client.getEntitlements())?.creditsRemaining).toBe(0);
  });

  it('upgrading leaves one live subscription', async () => {
    await signIn(ADMIN);
    await client.adminActivateSubscription(KARIM, 'monthly', 'comp');
    await client.adminActivateSubscription(KARIM, 'yearly', 'upgrade');
    await signIn(KARIM);
    const e = await client.getEntitlements();
    expect(e?.subscribed).toBe(true);
    expect(e?.tier).toBe('yearly');
  });

  it('ending a subscription puts the wall back', async () => {
    await signIn(ADMIN);
    await client.adminActivateSubscription(KARIM, 'monthly', 'comp');
    await client.adminEndSubscription(KARIM, 'refunded');
    await signIn(KARIM);
    const e = await client.getEntitlements();
    expect(e?.subscribed).toBe(false);
    expect(e?.canUsePregrade).toBe(false);
  });
});

describe('the Pre-Grade gate', () => {
  const captures = () => ({
    images: [1, 2, 3, 4].map((n) => ({ slot: `corner_${n}`, blob: new Blob(['x']) })),
    hasRake: true,
  });

  it('turns a free account away before any model call', async () => {
    await newSeller();
    await expect(client.assessPregrade(captures())).rejects.toThrow(/part of a subscription/i);
  });

  it('bought listings do not unlock it', async () => {
    await newSeller();
    const me = client.getAuthState().user!.id;
    await signIn(ADMIN);
    await client.adminGrantCredits(me, 10, 'pack');
    await signIn(me);
    expect((await client.getEntitlements())?.canUsePregrade).toBe(false);
    await expect(client.assessPregrade(captures())).rejects.toThrow(/part of a subscription/i);
  });

  it('runs for a subscriber and for an admin', async () => {
    await signIn(MAYA); // seeded subscriber
    expect((await client.getEntitlements())?.subscribed).toBe(true);
    await expect(client.assessPregrade(captures())).resolves.toBeTruthy();
    await signIn(ADMIN);
    await expect(client.assessPregrade(captures())).resolves.toBeTruthy();
  });
});

describe('the plan list', () => {
  it('reads the same four plans the migration seeds', async () => {
    const plans = await client.listPlans();
    expect(plans.map((p) => p.code)).toEqual(['monthly', 'yearly', 'credits_5', 'credits_15']);
    expect(plans.find((p) => p.code === 'monthly')?.priceUsd).toBe(5);
    expect(plans.find((p) => p.code === 'yearly')?.priceUsd).toBe(45);
  });

  it('keeps the billing queue admin-only', async () => {
    await signIn(LINA);
    await expect(client.adminListPurchases('pending')).rejects.toThrow(/restricted to admins/i);
    await expect(client.adminGrantCredits(LINA, 5, 'self-serve')).rejects.toThrow(
      /restricted to admins/i,
    );
  });

  it('counts a seeded pack that is already part-used', async () => {
    await signIn(LINA);
    const e = await client.getEntitlements();
    expect(e?.creditsRemaining).toBe(3);
  });
});
