import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SupportCategory, SupportMessage, SupportTicket } from '../lib/types';
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABELS } from '../lib/types';
import { relativeTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { usePageMeta } from '../lib/usePageMeta';
import { TicketThread } from '../components/support/TicketThread';
import '../components/support/support.css';
import './support.css';

/**
 * Support: open a ticket, see your tickets, talk to a moderator in one.
 * Deliberately available to suspended accounts — this is how they appeal.
 */
export function SupportPage() {
  const { id } = useParams<{ id: string }>();
  const { client, user, auth } = useApp();
  const navigate = useNavigate();
  usePageMeta({ title: id ? 'Support ticket' : 'Support', noindex: true });
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [thread, setThread] = useState<{ ticket: SupportTicket; messages: SupportMessage[] } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>('other');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setTickets(await client.listMyTickets());
    } catch {
      setTickets([]);
    }
    setState('ready');
  }, [client]);

  const loadThread = useCallback(async () => {
    if (!id) return;
    try {
      const t = await client.getSupportTicket(id);
      setThread(t);
      setState(t ? 'ready' : 'missing');
    } catch {
      setState('missing');
    }
  }, [client, id]);

  useEffect(() => {
    if (!user) return;
    if (id) {
      void loadThread();
      return client.subscribeToSupportTicket(id, () => void loadThread());
    }
    void loadList();
  }, [user, id, client, loadThread, loadList]);

  if (!auth.loading && !user) {
    return (
      <main className="support">
        <div className="empty-dashed">
          <h3>Support</h3>
          <p>Sign in to open a ticket — appeals, data requests, bugs, anything.</p>
          <Link to="/signin" className="btn-acid">Sign in</Link>
        </div>
      </main>
    );
  }
  if (!user) return null;

  const open = async () => {
    setBusy(true);
    setError('');
    try {
      const newId = await client.openSupportTicket(subject, category, body);
      setSubject('');
      setBody('');
      setComposing(false);
      navigate(`/support/${newId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the ticket.');
    } finally {
      setBusy(false);
    }
  };

  if (id) {
    return (
      <main className="support">
        <Link to="/support" className="mono-label support-back">← All tickets</Link>
        {state === 'missing' ? (
          <div className="empty-dashed">
            <h3>Ticket not found</h3>
            <p>It may belong to someone else, or the link is wrong.</p>
          </div>
        ) : thread ? (
          <section className="panel support-thread">
            <TicketThread
              ticket={thread.ticket}
              messages={thread.messages}
              staff={false}
              onChanged={() => void loadThread()}
            />
          </section>
        ) : (
          <div className="skeleton" style={{ height: 280 }} />
        )}
      </main>
    );
  }

  const open_ = tickets.filter((t) => t.status === 'open');
  const closed = tickets.filter((t) => t.status === 'closed');

  return (
    <main className="support">
      <header className="support-head">
        <div>
          <h1 className="display support-title">Support</h1>
          <p className="support-lede">
            A moderator reads every ticket. Appeals, data requests, a deal gone wrong, a bug —
            say what you need and we reply here. You will get a notification.
          </p>
        </div>
        {!composing && (
          <button type="button" className="btn-acid" onClick={() => setComposing(true)}>
            Open a ticket
          </button>
        )}
      </header>

      {composing && (
        <section className="panel tnew" aria-label="New ticket">
          <div className="tnew-row">
            <label className="support-field">
              <span className="mono-label">Subject</span>
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="In a few words"
                maxLength={140}
                autoFocus
              />
            </label>
            <label className="support-field">
              <span className="mono-label">About</span>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
              >
                {SUPPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SUPPORT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="support-field">
            <span className="mono-label">What happened</span>
            <textarea
              className="input"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The more specific, the faster we can help — listing links, dates, what you expected."
              maxLength={4000}
            />
          </label>
          {error && <p className="field-error">{error}</p>}
          <div className="support-actions">
            <button type="button" className="btn-acid" disabled={busy || subject.trim().length < 3 || !body.trim()} onClick={() => void open()}>
              {busy ? 'Opening…' : 'Send ticket'}
            </button>
            <button type="button" className="btn-outline" onClick={() => setComposing(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {state === 'loading' ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : tickets.length === 0 && !composing ? (
        <div className="empty-dashed">
          <h3>No tickets yet</h3>
          <p>When you open one, it shows up here with every reply.</p>
        </div>
      ) : (
        <>
          {open_.length > 0 && (
            <section>
              <h2 className="mono-label support-group">Open</h2>
              <ul className="tlist">
                {open_.map((t) => (
                  <li key={t.id}>
                    <Link to={`/support/${t.id}`} className={`trow${t.lastFrom === 'staff' ? ' is-waiting' : ''}`}>
                      <span className="trow-main">
                        <span className="trow-subject">{t.subject}</span>
                        <span className="mono-label trow-meta">
                          {SUPPORT_CATEGORY_LABELS[t.category]} · {relativeTime(t.updatedAt)}
                          {t.lastFrom === 'staff' ? ' · support replied' : ' · waiting for support'}
                        </span>
                      </span>
                      <span className={`trow-status is-${t.status}`}>{t.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <h2 className="mono-label support-group">Closed</h2>
              <ul className="tlist">
                {closed.map((t) => (
                  <li key={t.id}>
                    <Link to={`/support/${t.id}`} className="trow">
                      <span className="trow-main">
                        <span className="trow-subject">{t.subject}</span>
                        <span className="mono-label trow-meta">
                          {SUPPORT_CATEGORY_LABELS[t.category]} · closed {relativeTime(t.updatedAt)}
                        </span>
                      </span>
                      <span className="trow-status">closed</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
