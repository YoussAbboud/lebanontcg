import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SupportMessage, SupportStatus, SupportTicket } from '../../lib/types';
import { SUPPORT_CATEGORY_LABELS } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { TicketThread } from '../support/TicketThread';
import { Chip, PersonCell } from './shared';
import '../support/support.css';

/**
 * The support queue. Tickets the user wrote last come first — those are
 * the ones owed a reply. The selected ticket lives in the URL so one
 * moderator can hand it to another.
 */
export function AdminSupport({ onChanged }: { onChanged(): void }) {
  const { client } = useApp();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const selected = params.get('ticket');
  const [status, setStatus] = useState<SupportStatus>('open');
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [thread, setThread] = useState<{ ticket: SupportTicket; messages: SupportMessage[] } | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setRows(await client.adminListSupportTickets(status));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, status]);

  const loadThread = useCallback(async () => {
    if (!selected) {
      setThread(null);
      return;
    }
    try {
      setThread(await client.getSupportTicket(selected));
    } catch {
      setThread(null);
    }
  }, [client, selected]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadThread();
    if (!selected) return;
    return client.subscribeToSupportTicket(selected, () => void loadThread());
  }, [selected, client, loadThread]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('ticket', id);
    else next.delete('ticket');
    setParams(next, { replace: true });
  };

  const waiting = rows.filter((t) => t.lastFrom === 'user').length;

  return (
    <div className="asection asupport">
      <div className="afilters">
        {(['open', 'closed'] as SupportStatus[]).map((s) => (
          <button key={s} type="button" className="pill" aria-pressed={s === status} onClick={() => { setStatus(s); select(null); }}>
            {s}
          </button>
        ))}
        {status === 'open' && waiting > 0 && <Chip tone="acid">{waiting} waiting on us</Chip>}
      </div>

      <div className="asupport-layout">
        <div className="asupport-list">
          {state === 'error' ? (
            <div className="empty-dashed">
              <h3>Couldn&apos;t load the queue</h3>
              <button className="btn-outline" onClick={() => void load()}>Try again</button>
            </div>
          ) : state === 'loading' && rows.length === 0 ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : rows.length === 0 ? (
            <div className="empty-dashed">
              <h3>No {status} tickets</h3>
              <p>{status === 'open' ? 'Inbox zero. Enjoy it.' : 'Nothing closed yet.'}</p>
            </div>
          ) : (
            <ul className="tlist">
              {rows.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`trow${t.lastFrom === 'user' && t.status === 'open' ? ' is-waiting' : ''}${selected === t.id ? ' is-selected' : ''}`}
                    onClick={() => select(t.id)}
                    aria-current={selected === t.id}
                  >
                    <span className="trow-main">
                      <span className="trow-subject">{t.subject}</span>
                      <span className="mono-label trow-meta">
                        {t.user ? (t.user.username ? `@${t.user.username}` : t.user.displayName) : 'someone'} ·{' '}
                        {SUPPORT_CATEGORY_LABELS[t.category]} · {relativeTime(t.updatedAt)} · {t.messageCount} msg
                        {t.lastFrom === 'user' && t.status === 'open' ? ' · needs a reply' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="asupport-detail">
          {!selected ? (
            <div className="empty-dashed">
              <h3>Pick a ticket</h3>
              <p>The thread opens here. Reply, and close it when it is done.</p>
            </div>
          ) : !thread ? (
            <div className="skeleton" style={{ height: 240 }} />
          ) : (
            <div className="panel asupport-thread">
              {thread.ticket.user && (
                <div className="asupport-person">
                  <PersonCell profile={thread.ticket.user} />
                  {thread.ticket.user.suspendedAt && <Chip tone="danger">Suspended</Chip>}
                </div>
              )}
              <TicketThread
                ticket={thread.ticket}
                messages={thread.messages}
                staff
                onChanged={() => {
                  void loadThread();
                  void load();
                }}
                onClose={async (note) => {
                  await client.adminCloseSupportTicket(thread.ticket.id, note);
                  toast('Ticket closed');
                  onChanged();
                  await load();
                  await loadThread();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
