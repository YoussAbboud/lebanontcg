import { describe, expect, it } from 'vitest';
import { dayKeyOf, dayLabelOf, groupMessages, GROUP_WINDOW_MS } from './chat';
import type { Message } from './types';

let n = 0;
const msg = (over: Partial<Message>): Message => ({
  id: `m-${++n}`,
  conversationId: 'c-1',
  senderId: 'u-a',
  kind: 'user',
  body: 'hello',
  createdAt: '2026-03-04T12:00:00Z',
  readAt: null,
  ...over,
});

describe('groupMessages', () => {
  it('clusters consecutive same-sender messages within the window', () => {
    const t0 = Date.parse('2026-03-04T12:00:00Z');
    const messages = [
      msg({ senderId: 'u-a', createdAt: new Date(t0).toISOString() }),
      msg({ senderId: 'u-a', createdAt: new Date(t0 + 60_000).toISOString() }),
      msg({ senderId: 'u-b', createdAt: new Date(t0 + 90_000).toISOString() }),
      msg({ senderId: 'u-a', createdAt: new Date(t0 + 120_000).toISOString() }),
    ];
    const sections = groupMessages(messages);
    expect(sections).toHaveLength(1);
    expect(sections[0].clusters.map((c) => [c.senderId, c.messages.length])).toEqual([
      ['u-a', 2],
      ['u-b', 1],
      ['u-a', 1],
    ]);
  });

  it('breaks a cluster when the gap exceeds the window', () => {
    const t0 = Date.parse('2026-03-04T12:00:00Z');
    const messages = [
      msg({ createdAt: new Date(t0).toISOString() }),
      msg({ createdAt: new Date(t0 + GROUP_WINDOW_MS).toISOString() }),
      msg({ createdAt: new Date(t0 + GROUP_WINDOW_MS * 2 + 1000).toISOString() }),
    ];
    const sections = groupMessages(messages);
    expect(sections[0].clusters.map((c) => c.messages.length)).toEqual([2, 1]);
  });

  it('system messages always stand alone', () => {
    const t0 = Date.parse('2026-03-04T12:00:00Z');
    const messages = [
      msg({ senderId: 'u-a', createdAt: new Date(t0).toISOString() }),
      msg({ senderId: '', kind: 'system', body: 'sold', createdAt: new Date(t0 + 1000).toISOString() }),
      msg({ senderId: 'u-a', createdAt: new Date(t0 + 2000).toISOString() }),
    ];
    const clusters = groupMessages(messages)[0].clusters;
    expect(clusters.map((c) => c.kind)).toEqual(['user', 'system', 'user']);
  });

  it('splits sections across calendar days', () => {
    const messages = [
      msg({ createdAt: '2026-03-04T23:59:00' }),
      msg({ createdAt: '2026-03-05T00:01:00' }),
    ];
    const sections = groupMessages(messages);
    expect(sections).toHaveLength(2);
  });

  it('handles the empty thread', () => {
    expect(groupMessages([])).toEqual([]);
  });
});

describe('day labels', () => {
  const now = new Date('2026-03-05T10:00:00');

  it('labels today and yesterday', () => {
    expect(dayLabelOf('2026-03-05T01:00:00', now)).toBe('Today');
    expect(dayLabelOf('2026-03-04T23:00:00', now)).toBe('Yesterday');
  });

  it('labels older days with a date, adding the year when different', () => {
    expect(dayLabelOf('2026-03-01T12:00:00', now)).toMatch(/Mar/);
    expect(dayLabelOf('2025-12-31T12:00:00', now)).toMatch(/2025/);
  });

  it('day keys are stable calendar identifiers', () => {
    expect(dayKeyOf('2026-03-05T00:00:01')).toBe('2026-03-05');
    expect(dayKeyOf('2026-03-05T23:59:59')).toBe('2026-03-05');
  });
});
