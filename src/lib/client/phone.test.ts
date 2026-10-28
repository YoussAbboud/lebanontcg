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

describe('sharing a phone number in chat', () => {
  it('sends a phone message the other party sees as unread', async () => {
    await client.signInAsMockUser('u-karim');
    const conv = await client.openConversation('l-auc-6'); // @linacollects' listing
    const msg = await client.sharePhone(conv.id, '+96170123456', 'cid-1');
    expect(msg).toMatchObject({ kind: 'phone', body: '+96170123456', senderId: 'u-karim' });

    await client.signInAsMockUser('u-lina');
    const thread = await client.getMessages(conv.id);
    expect(thread.some((m) => m.kind === 'phone' && m.body === '+96170123456')).toBe(true);
    expect(await client.getTotalUnreadCount()).toBeGreaterThan(0);
    await client.markConversationRead(conv.id);
    const after = await client.getMessages(conv.id);
    expect(after.find((m) => m.kind === 'phone')?.readAt).not.toBeNull();
  });

  it('refuses anything that is not one E.164 number', async () => {
    await client.signInAsMockUser('u-karim');
    const conv = await client.openConversation('l-auc-6');
    await expect(client.sharePhone(conv.id, '70 123 456', 'cid-2')).rejects.toThrow(/phone number/);
    await expect(client.sharePhone(conv.id, '+961', 'cid-3')).rejects.toThrow(/phone number/);
  });
});
