import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Listing, ListingStatus } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { allowedTransitions, STATUS_LABELS } from '../lib/status';
import { formatPrice, relativeTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import './mylistings.css';

const TABS = ['all', 'active', 'reserved', 'sold', 'removed'] as const;
type Tab = (typeof TABS)[number];

export function MyListingsPage() {
  const { client, user } = useApp();
  const [listings, setListings] = useState<Listing[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setState('loading');
    try {
      setListings(
        await client.getListingsBySeller(user.id, ['active', 'reserved', 'sold', 'removed']),
      );
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
    setActionError(null);
    try {
      await client.setListingStatus(listing.id, status);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">My listings</h3>
        <p>Sign in to manage your listings.</p>
        <Link to="/signin" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mylist">
      <header className="mylist-head">
        <div>
          <h1 className="display">My listings</h1>
          <p>Your full inventory, across every status.</p>
        </div>
        <Link to="/sell" className="btn btn-primary">+ New listing</Link>
      </header>

      <div className="mylist-tabs" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className="chip"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : STATUS_LABELS[t]} ({counts[t]})
          </button>
        ))}
      </div>

      {actionError && <p className="field-error" role="alert">{actionError}</p>}

      {state === 'loading' && (
        <div className="mylist-rows" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 88 }} />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="empty-state" role="alert">
          <div className="empty-glyph" aria-hidden="true" />
          <h3 className="display">Couldn&apos;t load your listings</h3>
          <button className="btn btn-primary" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {state === 'ready' && visible.length === 0 && (
        <div className="empty-state">
          <div className="empty-glyph" aria-hidden="true" />
          <h3 className="display">
            {tab === 'all' ? 'Nothing listed yet' : `No ${tab} listings`}
          </h3>
          <p>
            {tab === 'all'
              ? 'List your first card — it takes about a minute.'
              : 'Listings move here as their status changes.'}
          </p>
          {tab === 'all' && <Link to="/sell" className="btn btn-primary">Sell a card</Link>}
        </div>
      )}

      {state === 'ready' && visible.length > 0 && (
        <ul className="mylist-rows">
          {visible.map((l) => (
            <li key={l.id} className="mylist-row card-surface">
              <Link to={`/listing/${l.id}`} className="mylist-media">
                {l.images[0] ? (
                  <img src={l.images[0].url} alt="" loading="lazy" />
                ) : (
                  <span className="mylist-noimg" aria-hidden="true" />
                )}
              </Link>
              <div className="mylist-info">
                <Link to={`/listing/${l.id}`} className="mylist-title">{l.title}</Link>
                <p className="mylist-meta">
                  {GAME_LABELS[l.game]} · {l.setName} · listed {relativeTime(l.createdAt)}
                </p>
                <p className="mylist-price-line">
                  <span className="price">{formatPrice(l.price, l.currency)}</span>
                  <span className={`badge badge-${l.status}`}>{STATUS_LABELS[l.status]}</span>
                </p>
              </div>
              <div className="mylist-actions">
                {(l.status === 'active' || l.status === 'reserved') && (
                  <Link to={`/sell/${l.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                )}
                {allowedTransitions(l.status).map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm ${s === 'sold' ? 'btn-primary' : s === 'removed' ? 'btn-danger' : 'btn-quiet'}`}
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
    </div>
  );
}
