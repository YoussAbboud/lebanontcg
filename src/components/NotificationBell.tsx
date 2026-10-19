import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AppNotification, NotificationKind } from '../lib/types';
import { relativeTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { Avatar } from './Avatar';
import './notificationbell.css';

const KIND_GLYPH: Record<NotificationKind, string> = {
  message: '✉',
  offer: '$',
  bid: '↑',
  outbid: '!',
  auction: '◆',
  review: '★',
  watch: '☆',
  moderation: '⚑',
};

/**
 * The bell: a badge with the unread count and a dropdown of the latest
 * notifications. Opening it marks what is shown as read a moment later —
 * the dot is for the glance, not a to-do list. The full list lives at
 * /notifications.
 */
export function NotificationBell() {
  const { client, user, unreadNotifications, refreshNotifications } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await client.listNotifications(12));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Keep the open panel live as new rows arrive.
  useEffect(() => {
    if (!open || !user) return;
    void load();
    return client.subscribeToNotifications(() => void load());
  }, [open, user, client, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const openOne = async (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) {
      client
        .markNotificationsRead([n.id])
        .then(refreshNotifications)
        .catch(() => {});
    }
    navigate(n.href);
  };

  const markAll = async () => {
    try {
      await client.markNotificationsRead();
      refreshNotifications();
      await load();
    } catch {
      /* the badge will catch up on the next event */
    }
  };

  return (
    <div className="nbell" ref={ref}>
      <button
        type="button"
        className="btn-icon nbell-btn"
        aria-label={
          unreadNotifications > 0
            ? `Notifications, ${unreadNotifications} unread`
            : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0v4l1.6 2.6c.4.7-.1 1.4-.9 1.4H5.3c-.8 0-1.3-.7-.9-1.4L6 13V9Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unreadNotifications > 0 && (
          <span className="nbell-badge" aria-hidden="true">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {open && (
        <div className="nbell-panel glass" role="dialog" aria-label="Notifications">
          <div className="nbell-head">
            <span className="mono-label">Notifications</span>
            {unreadNotifications > 0 && (
              <button type="button" className="btn-ghost-mono nbell-markall" onClick={() => void markAll()}>
                Mark all read
              </button>
            )}
          </div>
          {loading && items.length === 0 ? (
            <div className="nbell-empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="nbell-empty">
              Nothing yet. Messages, offers, bids and reviews land here.
            </div>
          ) : (
            <ul className="nbell-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`nbell-item${n.readAt ? '' : ' is-unread'}`}
                    onClick={() => void openOne(n)}
                  >
                    <span className="nbell-avatar" aria-hidden="true">
                      {n.actor ? (
                        <Avatar profile={n.actor} size={30} />
                      ) : (
                        <span className="nbell-glyph">{KIND_GLYPH[n.kind]}</span>
                      )}
                    </span>
                    <span className="nbell-text">
                      <span className="nbell-title">{n.title}</span>
                      {n.body && <span className="nbell-body">{n.body}</span>}
                      <span className="mono-label nbell-time">{relativeTime(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="nbell-dot" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="nbell-foot">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              See all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
