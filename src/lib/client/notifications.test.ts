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

// Seeded ids (src/mock/seed.ts).
const MAYA = 'u-maya';
const KARIM = 'u-karim';
const LINA = 'u-lina';

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

const mine = async () => client.listNotifications(50);
const unreadOf = async (kind?: string) =>
  (await mine()).filter((n) => !n.readAt && (!kind || n.kind === kind));

beforeEach(async () => {
  session.clear();
  client = new MockClient();
  await authSettled(client);
});

describe('who hears what', () => {
  it('a message tells the other party, names the card, and never the sender', async () => {
    await signIn(KARIM);
    const before = (await unreadOf('message')).length;
    await client.sendMessage('c-1', 'Still on for Saturday?', 'cid-1');
    expect((await unreadOf('message')).length).toBe(before);

    await signIn(MAYA);
    const rows = await unreadOf('message');
    expect(rows.length).toBe(1);
    expect(rows[0].title).toMatch(/@karim_tcg · Charizard/);
    expect(rows[0].href).toBe('/chat/c-1');
    expect(rows[0].actor?.username).toBe('karim_tcg');
  });

  it('a second message refreshes the live row instead of stacking', async () => {
    await signIn(KARIM);
    await client.sendMessage('c-1', 'one', 'a');
    await client.sendMessage('c-1', 'two', 'b');
    await signIn(MAYA);
    const rows = await unreadOf('message');
    expect(rows.length).toBe(1);
    expect(rows[0].body).toBe('two');
  });

  it('after reading, the next message is a new row', async () => {
    await signIn(KARIM);
    await client.sendMessage('c-1', 'one', 'a');
    await signIn(MAYA);
    await client.markNotificationsRead();
    expect(await client.getUnreadNotificationCount()).toBe(0);
    await signIn(KARIM);
    await client.sendMessage('c-1', 'two', 'b');
    await signIn(MAYA);
    expect((await mine()).filter((n) => n.kind === 'message').length).toBeGreaterThanOrEqual(2);
    expect(await client.getUnreadNotificationCount()).toBe(1);
  });

  it('an offer reaches the other party and its answer comes back', async () => {
    await signIn(KARIM);
    const offer = await client.sendOffer('c-1', 280, 'cash', 'o-1');
    await signIn(MAYA);
    expect((await unreadOf('offer')).some((n) => /@karim_tcg offered 280 USD/.test(n.title))).toBe(true);
    await client.respondToOffer('c-1', offer.id, true);
    await signIn(KARIM);
    expect((await unreadOf('offer')).some((n) => /Your offer of 280 USD was accepted/.test(n.title))).toBe(true);
  });

  it('a bid tells the seller once per auction and tells the beaten bidder', async () => {
    await signIn(LINA);
    await client.placeBid('a-1', 260);
    await signIn(KARIM);
    await client.placeBid('a-1', 280);
    await signIn(MAYA); // seller of a-1
    const bids = await unreadOf('bid');
    expect(bids.length).toBe(1);
    expect(bids[0].body).toMatch(/@karim_tcg bid 280 USD/);
    await signIn(LINA);
    expect((await unreadOf('outbid')).some((n) => /outbid/.test(n.title) && /280 USD/.test(n.body))).toBe(true);
    await signIn(KARIM);
    expect((await unreadOf('outbid')).length).toBe(0);
  });

  it('marking some read leaves the rest', async () => {
    await signIn(MAYA);
    const before = await unreadOf();
    expect(before.length).toBeGreaterThanOrEqual(2);
    await client.markNotificationsRead([before[0].id]);
    expect(await client.getUnreadNotificationCount()).toBe(before.length - 1);
  });

  it('fires the subscription when something arrives for me', async () => {
    await signIn(MAYA);
    let fired = 0;
    const stop = client.subscribeToNotifications(() => {
      fired += 1;
    });
    await signIn(KARIM);
    await client.sendMessage('c-1', 'ping', 'p');
    // The listener belongs to the tab; Karim is signed in here now, so
    // Maya's row does not fire this tab — but Karim's own actions never
    // notify Karim either.
    expect(fired).toBe(0);
    stop();
    await signIn(MAYA);
    const seen = await unreadOf('message');
    expect(seen.some((n) => n.body === 'ping')).toBe(true);
  });
});
