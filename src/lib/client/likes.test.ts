import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient } from './MockClient';

const session = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => void session.set(k, v),
  removeItem: (k: string) => void session.delete(k),
});
vi.stubGlobal('BroadcastChannel', undefined);

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

describe('live like counts', () => {
  it('watching and unwatching a listing pushes its new total to subscribers', async () => {
    await client.signInAsMockUser('u-karim');
    const id = 'l-auc-6'; // seed listing by another seller
    const heard: Array<[string, number]> = [];
    const stop = client.subscribeToLikeCounts((l, likes) => heard.push([l, likes]));

    const watching = (await client.getFavoriteIds()).has(id);
    await client.setFavorite(id, !watching);
    await client.setFavorite(id, watching);

    expect(heard.map(([l]) => l)).toEqual([id, id]);
    // The first push is the toggled total, the second is back where it was.
    expect(heard[0][1] - heard[1][1]).toBe(watching ? -1 : 1);

    stop();
    await client.setFavorite(id, !watching);
    expect(heard).toHaveLength(2);
  });
});
