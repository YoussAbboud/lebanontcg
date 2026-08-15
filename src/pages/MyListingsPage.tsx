import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Listing, ListingStatus } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { allowedTransitions, STATUS_LABELS } from '../lib/status';
import { formatPrice, relativeTime } from '../lib/format';
import { thumbBackground, glyphOf } from '../lib/face';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import './mylistings.css';

const TABS = ['all', 'active', 'reserved', 'sold', 'removed'] as const;
type Tab = (typeof TABS)[number];

export function MyListingsPage() {
  const { client, user } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setState('loading');
    try {
      setListings(await client.getListingsBySeller(user.id, ['active', 'reserved', 'sold', 'removed']));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: listings.length, active: 0, reserved: 0, sold: 0, removed: 0 };
    for (const l of listings) c[l.status]++;
    return c;
  }, [listings]);

  const visible = tab === 'all' ? listings : listings.filter((l) => l.status === tab);

  const changeStatus = async (listing: Listing, status: ListingStatus) => {
    setBusyId(listing.id);
    try {
      await client.setListingStatus(listing.id, status);
      await load();
      toast(`Marked ${STATUS_LABELS[status].toLowerCase()}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <main className="mylist">
        <div className="empty-dashed">
          <h3>My listings</h3>
          <p>Sign in to manage your listings.</p>
          <Link to="/signin" className="btn-acid">Sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mylist">
      <div className="section-head">
        <h1>My listings</h1>
        <div className="mono-label">{String(listings.length).padStart(2, '0')} total</div>
        <Link to="/sell" className="btn-acid mylist-new">List a card</Link>
      </div>

      <div className="mylist-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className="pill"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : STATUS_LABELS[t]} ({counts[t]})
          </button>
        ))}
      </div>

      {state === 'loading' && (
        <div className="mylist-rows" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 88 }} />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="empty-dashed" role="alert">
          <h3>Couldn&apos;t load your listings</h3>
          <p>Something went wrong on our side.</p>
          <button className="btn-acid" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {state === 'ready' && visible.length === 0 && (
        <div className="empty-dashed">
          <h3>{tab === 'all' ? 'Nothing listed yet' : `No ${tab} listings`}</h3>
          <p>
            {tab === 'all'
              ? 'List your first card — it takes about a minute.'
              : 'Listings move here as their status changes.'}
          </p>
          {tab === 'all' && <Link to="/sell" className="btn-acid">List a card</Link>}
        </div>
      )}

      {state === 'ready' && visible.length > 0 && (
        <ul className="mylist-rows">
          {visible.map((l) => (
            <li key={l.id} className="panel mylist-row">
              <button
                type="button"
                className="mylist-media"
                style={
                  l.images[0]
                    ? { backgroundImage: `url(${l.images[0].url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: thumbBackground(l.id) }
                }
                aria-label={`Open ${l.title}`}
                onClick={() => navigate(`/listing/${l.id}`)}
              >
                {!l.images[0] && glyphOf(l.title)}
              </button>
              <div className="mylist-info">
                <Link to={`/listing/${l.id}`} className="mylist-title display">{l.title}</Link>
                <div className="mono-label mylist-meta">
                  {GAME_LABELS[l.game]} · {l.setName} · listed {relativeTime(l.createdAt)}
                </div>
                <div className="mylist-price-line">
                  <span className="mono-value">{formatPrice(l.price, l.currency)}</span>
                  <span
                    className={`mono-label ${
                      l.status === 'active'
                        ? 'mylist-status-active'
                        : l.status === 'reserved'
                          ? 'mylist-status-reserved'
                          : 'mylist-status-muted'
                    }`}
                  >
                    {STATUS_LABELS[l.status]}
                  </span>
                </div>
              </div>
              <div className="mylist-actions">
                {(l.status === 'active' || l.status === 'reserved') && (
                  <Link to={`/sell/${l.id}`} className="btn-outline mylist-btn">Edit</Link>
                )}
                {allowedTransitions(l.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`mylist-btn ${s === 'sold' ? 'btn-acid' : s === 'removed' ? 'btn-outline btn-danger-outline' : 'btn-outline'}`}
                    disabled={busyId === l.id}
                    onClick={() => void changeStatus(l, s)}
                  >
                    {s === 'active'
                      ? l.status === 'removed' ? 'Relist' : 'Unreserve'
                      : s === 'reserved' ? 'Reserve'
                      : s === 'sold' ? 'Mark sold'
                      : 'Remove'}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
