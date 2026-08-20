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

// Seeded ids (src/mock/seed.ts): u-admin is the moderator account.
const ADMIN = 'u-admin';
const MAYA = 'u-maya';
const KARIM = 'u-karim';

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

beforeEach(async () => {
  session.clear();
  client = new MockClient();
  await authSettled(client);
  await signIn(ADMIN);
});

describe('admin access', () => {
  it('refuses every admin surface to a non-admin', async () => {
    await signIn(MAYA);
    await expect(client.getAdminStats()).rejects.toThrow(/restricted to admins/i);
    await expect(client.adminListUsers('', 10)).rejects.toThrow(/restricted to admins/i);
    await expect(client.adminListReports('open')).rejects.toThrow(/restricted to admins/i);
    await expect(client.adminSetSuspended(KARIM, true, 'because')).rejects.toThrow(
      /restricted to admins/i,
    );
  });

  it('lets an admin read the console', async () => {
    const stats = await client.getAdminStats();
    expect(stats.users).toBeGreaterThan(0);
    expect(stats.admins).toBe(1);
  });

  it('will not let an admin suspend themselves or drop their own flag', async () => {
    await expect(client.adminSetSuspended(ADMIN, true, 'oops')).rejects.toThrow(/your own account/i);
    await expect(client.adminSetAdmin(ADMIN, false)).rejects.toThrow(/another admin/i);
  });

  it('requires a reason to suspend, but not to lift', async () => {
    await expect(client.adminSetSuspended(KARIM, true, 'no')).rejects.toThrow(/reason is required/i);
    const suspended = await client.adminSetSuspended(KARIM, true, 'Counterfeit listings');
    expect(suspended.suspendedAt).not.toBeNull();
    const lifted = await client.adminSetSuspended(KARIM, false, '');
    expect(lifted.suspendedAt).toBeNull();
    expect(lifted.suspendedReason).toBeNull();
  });

  it('refuses to promote a suspended account, or suspend an admin', async () => {
    await client.adminSetSuspended(KARIM, true, 'Counterfeit listings');
    await expect(client.adminSetAdmin(KARIM, true)).rejects.toThrow(/lift the suspension/i);

    await client.adminSetSuspended(KARIM, false, '');
    await client.adminSetAdmin(KARIM, true);
    await expect(client.adminSetSuspended(KARIM, true, 'changed my mind')).rejects.toThrow(
      /demote this admin/i,
    );
  });
});

describe('suspension', () => {
  it('stops the account creating anything new', async () => {
    await client.adminSetSuspended(KARIM, true, 'Counterfeit listings');
    await signIn(KARIM);

    await expect(
      client.createListing(
        {
          title: 'A card',
          game: 'pokemon',
          setName: '',
          cardNumber: '',
          language: 'English',
          condition: 'NM',
          finish: 'normal',
          gradeCompany: null,
          gradeValue: null,
          price: 10,
          currency: 'USD',
          quantity: 1,
          description: '',
        },
        [],
      ),
    ).rejects.toThrow(/suspended/i);

    const conversations = await client.listConversations();
    expect(conversations.length).toBeGreaterThan(0);
    await expect(client.sendMessage(conversations[0].id, 'hello?', 'c1')).rejects.toThrow(
      /suspended/i,
    );
  });

  it('leaves their history readable — reading is never the punishment', async () => {
    await client.adminSetSuspended(MAYA, true, 'Under review');
    await signIn(MAYA);
    const conversations = await client.listConversations();
    expect(conversations.length).toBeGreaterThan(0);
    expect((await client.getMessages(conversations[0].id)).length).toBeGreaterThan(0);
  });

  it('blocks bidding while suspended', async () => {
    const live = await client.adminListAuctions('live');
    const auction = live.find((a) => a.auction.sellerId !== KARIM);
    expect(auction).toBeDefined();

    await client.adminSetSuspended(KARIM, true, 'Under review');
    await signIn(KARIM);
    await expect(client.placeBid(auction!.auction.id, 10_000)).rejects.toThrow(/suspended/i);
  });
});

describe('listing moderation', () => {
  it('forces a status the seller-facing rules forbid', async () => {
    const [report] = await client.adminListReports('all');
    expect(report).toBeDefined();

    // sold is terminal for sellers; moderation still has to be able to
    // pull a fraudulent listing down from it.
    await client.adminSetListingStatus('l-001', 'sold', '');
    const removed = await client.adminSetListingStatus('l-001', 'removed', 'Counterfeit');
    expect(removed.status).toBe('removed');
  });

  it('demands a reason before removing', async () => {
    await expect(client.adminSetListingStatus('l-002', 'removed', '')).rejects.toThrow(
      /reason is required/i,
    );
  });

  it('tells the conversations a moderator did it, not the seller', async () => {
    await client.adminSetListingStatus('l-001', 'removed', 'Counterfeit');
    await signIn(KARIM);
    const conv = (await client.listConversations()).find((c) => c.listingId === 'l-001');
    expect(conv).toBeDefined();
    const bodies = (await client.getMessages(conv!.id)).map((m) => m.body);
    expect(bodies).toContain('A moderator removed this listing.');
  });

  it('deletes a listing along with everything hanging off it', async () => {
    await signIn(KARIM);
    expect((await client.listConversations()).some((c) => c.listingId === 'l-001')).toBe(true);

    await signIn(ADMIN);
    await client.adminDeleteListing('l-001', 'Illegal content');
    expect(await client.getListing('l-001')).toBeNull();

    await signIn(KARIM);
    expect((await client.listConversations()).some((c) => c.listingId === 'l-001')).toBe(false);
  });
});

describe('reviews', () => {
  it('re-rolls the reviewee rating, blanking it when the last one goes', async () => {
    const reviews = await client.adminListReviews('', 100);
    expect(reviews.length).toBeGreaterThan(0);
    const revieweeId = reviews[0].revieweeId;
    const theirs = reviews.filter((r) => r.revieweeId === revieweeId);

    for (const r of theirs) await client.adminDeleteReview(r.id, 'Fake reviews');

    const profile = await client.getProfile(revieweeId);
    expect(profile?.ratingCount).toBe(0);
    expect(profile?.ratingAvg).toBeNull();
  });

  it('demands a reason', async () => {
    const [review] = await client.adminListReviews('', 1);
    await expect(client.adminDeleteReview(review.id, '')).rejects.toThrow(/reason is required/i);
  });
});

describe('the report queue', () => {
  it('shows filed reports as open, with the subject resolved', async () => {
    await signIn(MAYA);
    await client.submitReport({
      targetType: 'listing',
      targetId: 'l-002',
      reason: 'counterfeit',
      detail: 'Wrong holo pattern',
    });

    await signIn(ADMIN);
    const open = await client.adminListReports('open');
    const filed = open.find((r) => r.targetId === 'l-002');
    expect(filed).toBeDefined();
    expect(filed!.status).toBe('open');
    expect(filed!.reporter?.id).toBe(MAYA);
    expect(filed!.subject?.kind).toBe('listing');
    expect(filed!.subject?.href).toBe('/listing/l-002');
  });

  it('records who closed a report and when', async () => {
    const [first] = await client.adminListReports('open');
    await client.adminResolveReport(first.id, 'resolved', 'Seller warned');

    const resolved = (await client.adminListReports('resolved')).find((r) => r.id === first.id);
    expect(resolved?.resolvedBy).toBe(ADMIN);
    expect(resolved?.resolvedAt).not.toBeNull();
    expect(resolved?.resolutionNote).toBe('Seller warned');
    expect((await client.adminListReports('open')).some((r) => r.id === first.id)).toBe(false);
  });

  it('survives a subject that has since been deleted', async () => {
    await client.adminDeleteListing('l-004', 'Illegal content');
    const all = await client.adminListReports('all');
    const orphan = all.find((r) => r.targetId === 'l-004');
    expect(orphan).toBeDefined();
    expect(orphan!.subject).toBeNull();
  });
});

describe('the audit log', () => {
  it('records every action with its actor, target and reason', async () => {
    await client.adminSetSuspended(KARIM, true, 'Counterfeit listings');
    await client.adminSetListingStatus('l-002', 'removed', 'Counterfeit');

    const log = await client.adminListActions(20);
    expect(log).toHaveLength(2);

    const [newest, older] = log;
    expect(newest.kind).toBe('listing_status');
    expect(newest.targetId).toBe('l-002');
    expect(newest.detail).toMatchObject({ to: 'removed' });
    expect(older.kind).toBe('user_suspend');
    expect(older.actorId).toBe(ADMIN);
    expect(older.actor?.username).toBe('mods');
    expect(older.reason).toBe('Counterfeit listings');
  });

  it('only ever grows — a rejected action leaves no row', async () => {
    await client.adminSetSuspended(KARIM, true, 'Counterfeit listings');
    const before = (await client.adminListActions(50)).length;

    await expect(client.adminSetListingStatus('l-002', 'removed', '')).rejects.toThrow();
    await expect(client.adminSetSuspended(ADMIN, true, 'oops')).rejects.toThrow();

    expect((await client.adminListActions(50)).length).toBe(before);
  });
});
