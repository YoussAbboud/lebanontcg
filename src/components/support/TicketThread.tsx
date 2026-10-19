import { useEffect, useRef, useState } from 'react';
import type { SupportMessage, SupportTicket } from '../../lib/types';
import { SUPPORT_CATEGORY_LABELS } from '../../lib/types';
import { relativeTime, timeOfDay } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { Avatar } from '../Avatar';
import './support.css';

/**
 * One ticket's conversation, shared by the person's page and the admin
 * queue. The owner and moderators write; a closed ticket takes staff
 * replies only (which reopen it).
 */
export function TicketThread({
  ticket,
  messages,
  staff,
  onChanged,
  onClose,
}: {
  ticket: SupportTicket;
  messages: SupportMessage[];
  /** True when the viewer is a moderator. */
  staff: boolean;
  onChanged(): void;
  /** Staff only: close the ticket with an optional last word. */
  onClose?(note: string): Promise<void>;
}) {
  const { client, user } = useApp();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const canReply = staff || ticket.status === 'open';

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      await client.replySupportTicket(ticket.id, body);
      setDraft('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tthread">
      <header className="tthread-head">
        <div>
          <h2 className="tthread-subject">{ticket.subject}</h2>
          <p className="mono-label tthread-meta">
            {SUPPORT_CATEGORY_LABELS[ticket.category]} · opened {relativeTime(ticket.createdAt)}
            {ticket.user && staff ? ` · by ${ticket.user.username ? `@${ticket.user.username}` : ticket.user.displayName}` : ''}
          </p>
        </div>
        <span className={`tthread-status is-${ticket.status}`}>{ticket.status}</span>
      </header>

      <ol className="tthread-list">
        {messages.map((m) => {
          const mine = m.sender?.id === user?.id;
          const system = m.sender === null;
          return (
            <li key={m.id} className={`tmsg${system ? ' tmsg-system' : mine ? ' tmsg-mine' : ''}`}>
              {!system && (
                <span className="tmsg-avatar" aria-hidden="true">
                  {m.sender ? <Avatar profile={m.sender} size={28} /> : null}
                </span>
              )}
              <div className="tmsg-bubble">
                {!system && (
                  <span className="mono-label tmsg-who">
                    {m.fromStaff ? 'Support' : m.sender?.username ? `@${m.sender.username}` : (m.sender?.displayName ?? 'You')}
                    {m.fromStaff && m.sender?.username ? ` · @${m.sender.username}` : ''}
                  </span>
                )}
                <p className="tmsg-body">{m.body}</p>
                <span className="mono-label tmsg-time">{timeOfDay(m.createdAt)}</span>
              </div>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>

      {canReply ? (
        <div className="tthread-compose">
          <textarea
            className="input tthread-input"
            placeholder={staff ? 'Reply as support…' : 'Add to your ticket…'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={4000}
          />
          <button type="button" className="btn-acid" disabled={busy || !draft.trim()} onClick={() => void send()}>
            Send
          </button>
        </div>
      ) : (
        <p className="tthread-closed mono-label">
          This ticket is closed. If anything is still unresolved, open a new one.
        </p>
      )}
      {error && <p className="field-error">{error}</p>}

      {staff && ticket.status === 'open' && onClose && (
        <div className="tthread-close">
          {closing ? (
            <>
              <input
                className="input"
                placeholder="A last word for them (optional)"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                maxLength={1000}
              />
              <button
                type="button"
                className="btn-outline btn-danger-outline"
                onClick={async () => {
                  await onClose(closeNote.trim());
                  setClosing(false);
                  setCloseNote('');
                }}
              >
                Close ticket
              </button>
              <button type="button" className="btn-ghost-mono" onClick={() => setClosing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn-outline" onClick={() => setClosing(true)}>
              Close ticket…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
