import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AppNotification } from '../lib/types';
import { relativeTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { usePageMeta } from '../lib/usePageMeta';
import { Avatar } from '../components/Avatar';
import './notifications.css';

/** The long list behind the bell. */
export function NotificationsPage() {
  const { client, user, unreadNotifications, refreshNotifications } = useApp();
  usePageMeta({ title: 'Notifications', noindex: true });
  const [items, setItems] = useState<AppNotification[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    try {
      setItems(await client.listNotifications(100));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client]);

  useEffect(() => {
    if (!user) return;
    void load();
    return client.subscribeToNotifications(() => void load());
  }, [client, user, load]);

  if (!user) {
    return (
      <main className="notifs">
        <div className="empty-dashed">
          <h3>Notifications</h3>
          <p>Sign in to see what's new.</p>
          <Link to="/signin" className="btn-acid">Sign in</Link>
        </div>
      </main>
    );
  }

  const markAll = async () => {
    await client.markNotificationsRead().catch(() => {});
    refreshNotifications();
    await load();
  };

  return (
    <main className="notifs">
      <div className="notifs-head">
        <h1 className="display notifs-title">Notifications</h1>
        {unreadNotifications > 0 && (
          <button type="button" className="btn-outline" onClick={() => void markAll()}>
            Mark all read
          </button>
        )}
      </div>
      {state === 'error' ? (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load notifications</h3>
          <button className="btn-outline" onClick={() => void load()}>Try again</button>
        </div>
      ) : state === 'loading' ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : items.length === 0 ? (
        <div className="empty-dashed">
          <h3>Nothing yet</h3>
          <p>Messages, offers, bids, reviews and watchlist changes land here.</p>
        </div>
      ) : (
        <ul className="notifs-list">
          {items.map((n) => (
            <li key={n.id} className={`notifs-item panel${n.readAt ? '' : ' is-unread'}`}>
              <Link
                to={n.href}
                className="notifs-link"
                onClick={() => {
                  if (!n.readAt) {
                    client.markNotificationsRead([n.id]).then(refreshNotifications).catch(() => {});
                  }
                }}
              >
                <span className="notifs-avatar" aria-hidden="true">
                  {n.actor ? <Avatar profile={n.actor} size={34} /> : <span className="notifs-glyph">◆</span>}
                </span>
                <span className="notifs-text">
                  <span className="notifs-item-title">{n.title}</span>
                  {n.body && <span className="notifs-body">{n.body}</span>}
                  <span className="mono-label notifs-time">{relativeTime(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="notifs-dot" aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
