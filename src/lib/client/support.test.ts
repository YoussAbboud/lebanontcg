import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient } from './MockClient';

const session = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => void session.set(k, v),
  removeItem: (k: string) => void session.delete(k),
});
vi.stubGlobal('BroadcastChannel', undefined);
const gradient = { addColorStop: () => undefined };
const context2d = new Proxy({}, { get: (_t, prop) => (typeof prop === 'string' && prop.startsWith('create') ? () => gradient : prop === 'measureText' ? () => ({ width: 10 }) : () => undefined), set: () => true });
vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context2d, toDataURL: () => 'data:image/png;base64,stub' }) });

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
});

describe('support tickets', () => {
  it('a suspended account can still open a ticket and appeal', async () => {
    await signIn(ADMIN);
    await client.adminSetSuspended(KARIM, true, 'Counterfeits');
    await signIn(KARIM);
    const id = await client.openSupportTicket('My suspension', 'appeal', 'This was a mistake.');
    const mine = await client.listMyTickets();
    expect(mine.map((t) => t.id)).toContain(id);
    expect(mine.find((t) => t.id === id)?.status).toBe('open');
  });

  it('only the owner and moderators see it; staff are notified', async () => {
    await signIn(KARIM);
    const id = await client.openSupportTicket('Photo bug', 'bug', 'Cropper never opens.');
    await signIn(MAYA);
    expect(await client.getSupportTicket(id)).toBeNull();
    await expect(client.replySupportTicket(id, 'me too')).rejects.toThrow(/not your ticket/i);
    await expect(client.adminListSupportTickets('open')).rejects.toThrow(/restricted to admins/i);
    await signIn(ADMIN);
    const queue = await client.adminListSupportTickets('open');
    expect(queue.some((t) => t.id === id && t.lastFrom === 'user' && t.user?.username === 'karim_tcg')).toBe(true);
    const notes = (await client.listNotifications(20)).filter((n) => n.kind === 'support');
    expect(notes.some((n) => /New ticket — Photo bug/.test(n.title))).toBe(true);
  });

  it('replies go both ways, each side is told, and closing is staff-only', async () => {
    await signIn(KARIM);
    const id = await client.openSupportTicket('Photo bug', 'bug', 'Cropper never opens.');
    await expect(client.adminCloseSupportTicket(id, 'no')).rejects.toThrow(/restricted to admins/i);
    await signIn(ADMIN);
    await client.replySupportTicket(id, 'Which phone?');
    expect((await client.adminListSupportTickets('open')).find((t) => t.id === id)?.lastFrom).toBe('staff');
    await signIn(KARIM);
    expect((await client.listNotifications(20)).some((n) => /Support replied — Photo bug/.test(n.title))).toBe(true);
    await client.replySupportTicket(id, 'iPhone 15.');
    const thread = await client.getSupportTicket(id);
    expect(thread?.messages.map((m) => m.fromStaff)).toEqual([false, true, false]);
    await signIn(ADMIN);
    await client.adminCloseSupportTicket(id, 'Fixed in the last release — try again.');
    expect((await client.adminListSupportTickets('closed')).some((t) => t.id === id)).toBe(true);
    await expect(client.adminCloseSupportTicket(id, '')).rejects.toThrow(/no open ticket/i);
    await signIn(KARIM);
    const closed = await client.getSupportTicket(id);
    expect(closed?.ticket.status).toBe('closed');
    expect(closed?.messages.at(-1)?.sender).toBeNull();
    await expect(client.replySupportTicket(id, 'still broken')).rejects.toThrow(/closed/i);
    expect((await client.listNotifications(20)).some((n) => /Ticket closed — Photo bug/.test(n.title))).toBe(true);
    await signIn(ADMIN);
    await client.replySupportTicket(id, 'One more question.');
    expect((await client.getSupportTicket(id))?.ticket.status).toBe('open');
  });
});
