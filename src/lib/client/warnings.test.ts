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
  await signIn(ADMIN);
});

describe('warnings', () => {
  it('only moderators warn, never themselves, never without a reason', async () => {
    await expect(client.adminWarnUser(ADMIN, 'me')).rejects.toThrow(/your own account/i);
    await expect(client.adminWarnUser(KARIM, 'no')).rejects.toThrow(/reason is required/i);
    await signIn(KARIM);
    await expect(client.adminWarnUser(MAYA, 'because')).rejects.toThrow(/restricted to admins/i);
  });

  it('counts up, names the listing, and tells the person', async () => {
    const listing = (await client.getListingsBySeller(KARIM, ['active']))[0];
    expect(await client.adminWarnUser(KARIM, 'Counterfeit card', listing.id)).toBe(1);
    expect(await client.adminWarnUser(KARIM, 'Misleading photos')).toBe(2);
    const rows = await client.adminListWarnings(KARIM);
    expect(rows.length).toBe(2);
    expect(rows.find((w) => w.reason === 'Counterfeit card')?.listingTitle).toBe(listing.title);
    expect((await client.adminListUsers('karim', 5))[0].warningCount).toBe(2);

    await signIn(KARIM);
    const mine = await client.listMyWarnings();
    expect(mine.length).toBe(2);
    const notes = (await client.listNotifications(20)).filter((n) => n.kind === 'moderation');
    expect(notes.some((n) => /Warning 1 of 3/.test(n.title))).toBe(true);
    expect(notes.some((n) => /Warning 2 of 3/.test(n.title))).toBe(true);
    expect(client.getAuthState().user?.suspendedAt ?? null).toBeNull();
  });

  it('the third warning suspends through the normal path, with an audit row', async () => {
    await client.adminWarnUser(KARIM, 'One');
    await client.adminWarnUser(KARIM, 'Two');
    expect(await client.adminWarnUser(KARIM, 'Three')).toBe(3);
    const row = (await client.adminListUsers('karim', 5))[0];
    expect(row.profile.suspendedAt).not.toBeNull();
    expect(row.profile.suspendedReason).toMatch(/^3 warnings — Three/);
    const actions = await client.adminListActions(20);
    expect(actions.filter((a) => a.kind === 'user_warn' && a.targetId === KARIM).length).toBe(3);
    expect(actions.some((a) => a.kind === 'user_suspend' && a.targetId === KARIM)).toBe(true);

    await signIn(KARIM);
    await expect(
      client.createListing(
        {
          title: 'Nope',
          game: 'pokemon',
          setName: '',
          cardNumber: '',
          language: 'English',
          condition: 'NM',
          finish: 'normal',
          gradeCompany: null,
          gradeValue: null,
          price: 5,
          currency: 'USD',
          quantity: 1,
          description: '',
        },
        [],
      ),
    ).rejects.toThrow(/suspended/i);
  });

  it('withdrawing a warning does not lift the suspension; lifting is separate', async () => {
    await client.adminWarnUser(KARIM, 'One');
    await client.adminWarnUser(KARIM, 'Two');
    await client.adminWarnUser(KARIM, 'Three');
    const w = (await client.adminListWarnings(KARIM)).find((x) => x.reason === 'Two')!;
    await client.adminRevokeWarning(w.id, 'Reviewed — fine');
    let row = (await client.adminListUsers('karim', 5))[0];
    expect(row.warningCount).toBe(2);
    expect(row.profile.suspendedAt).not.toBeNull();
    await expect(client.adminRevokeWarning(w.id, 'again')).rejects.toThrow(/no active warning/i);

    await client.adminSetSuspended(KARIM, false, 'Second chance');
    row = (await client.adminListUsers('karim', 5))[0];
    expect(row.profile.suspendedAt).toBeNull();
    expect((await client.adminListWarnings(KARIM)).length).toBe(3);
    // The next one puts them back at three — and back out.
    expect(await client.adminWarnUser(KARIM, 'Four')).toBe(3);
    expect((await client.adminListUsers('karim', 5))[0].profile.suspendedAt).not.toBeNull();
  });
});
