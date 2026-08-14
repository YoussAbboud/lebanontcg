import type { Message } from './types';

// Message grouping/timestamp logic for the thread view — pure and
// unit-tested. Consecutive same-sender user messages within GROUP_WINDOW_MS
// share one cluster; date dividers separate calendar days; system messages
// always stand alone.

export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface MessageCluster {
  kind: 'user' | 'system';
  senderId: string;
  messages: Message[];
}

export interface ThreadSection {
  /** Calendar day label, e.g. "Today", "Yesterday", "Mar 4". */
  dayLabel: string;
  dayKey: string;
  clusters: MessageCluster[];
}

export function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabelOf(iso: string, now = new Date()): string {
  const key = dayKeyOf(iso);
  const todayKey = dayKeyOf(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === todayKey) return 'Today';
  if (key === dayKeyOf(yesterday.toISOString())) return 'Yesterday';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Group an ordered message list into day sections of sender clusters. */
export function groupMessages(messages: Message[], now = new Date()): ThreadSection[] {
  const sections: ThreadSection[] = [];
  for (const msg of messages) {
    const key = dayKeyOf(msg.createdAt);
    let section = sections[sections.length - 1];
    if (!section || section.dayKey !== key) {
      section = { dayKey: key, dayLabel: dayLabelOf(msg.createdAt, now), clusters: [] };
      sections.push(section);
    }
    const prev = section.clusters[section.clusters.length - 1];
    const prevMsg = prev?.messages[prev.messages.length - 1];
    const canJoin =
      prev &&
      prevMsg &&
      msg.kind === 'user' &&
      prev.kind === 'user' &&
      prev.senderId === msg.senderId &&
      new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() <= GROUP_WINDOW_MS;
    if (canJoin) {
      prev.messages.push(msg);
    } else {
      section.clusters.push({ kind: msg.kind, senderId: msg.senderId, messages: [msg] });
    }
  }
  return sections;
}
