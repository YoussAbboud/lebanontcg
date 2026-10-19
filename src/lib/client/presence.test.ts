import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient } from './MockClient';

const session = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => void session.set(k, v),
  removeItem: (k: string) => void session.delete(k),
});
vi.stubGlobal('BroadcastChannel', undefined);
vi.stubGlobal('window', {
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
  clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
});

let client: MockClient;
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
});

describe('who is online', () => {
  it('a visitor sees the always-online demo accounts and nobody else', () => {
    let seen = new Set<string>();
    const stop = client.subscribeToOnline((ids) => {
      seen = ids;
    });
    expect(seen.has('u-maya')).toBe(true);
    expect(seen.has('u-karim')).toBe(false);
    stop();
  });

  it('a signed-in tab announces itself and leaves when it unsubscribes', async () => {
    await client.signInAsMockUser('u-karim');
    let seen = new Set<string>();
    const stop = client.subscribeToOnline((ids) => {
      seen = ids;
    });
    expect(seen.has('u-karim')).toBe(true);
    stop();
    // Signed out, this tab is a visitor again — and Karim's heartbeat is gone.
    await client.signOut();
    let after = new Set<string>();
    const stop2 = client.subscribeToOnline((ids) => {
      after = ids;
    });
    expect(after.has('u-karim')).toBe(false);
    stop2();
  });
});
