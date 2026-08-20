import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AdminListingFilter, ListingStatus, ListingWithSeller } from '../../lib/types';
import { GAME_LABELS } from '../../lib/types';
import { STATUS_LABELS } from '../../lib/status';
import { formatPrice, relativeTime } from '../../lib/format';
import { thumbBackground, glyphOf } from '../../lib/face';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { ReasonPrompt } from './ReasonPrompt';
import { Chip, handleOf } from './shared';

const PAGE = 20;

const STATUSES: Array<ListingStatus | 'all'> = ['all', 'active', 'reserved', 'sold', 'removed'];

const STATUS_TONE: Record<ListingStatus, 'plain' | 'acid' | 'danger' | 'warn'> = {
  active: 'acid',
  reserved: 'warn',
  sold: 'plain',
  removed: 'danger',
};

interface Pending {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  requireReason: boolean;
  destructive: boolean;
  run(reason: string): Promise<void>;
}

export function AdminListings({ onChanged }: { onChanged(): void }) {
  const { client } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState<AdminListingFilter>({
    q: '',
    status: 'all',
    saleType: 'all',
  });
  const [limit, setLimit] = useState(PAGE);
  const [items, setItems] = useState<ListingWithSeller[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const page = await client.adminSearchListings(filter, 0, limit);
      setItems(page.items);
      setTotal(page.total);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, filter, limit]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const after = async (message: string) => {
    toast(message);
    onChanged();
    await load();
  };

  const changeStatus = (listing: ListingWithSeller, status: ListingStatus) => {
    const removing = status === 'removed';
    setPending({
      title: `Force status: ${STATUS_LABELS[status]}`,
      body: (
        <>
          <strong>{listing.title}</strong> moves from {STATUS_LABELS[listing.status].toLowerCase()}{' '}
          to {STATUS_LABELS[status].toLowerCase()}. Everyone in its conversations is told.
          {removing && ' It leaves browse immediately and can be restored later.'}
        </>
      ),
      confirmLabel: `Set ${STATUS_LABELS[status].toLowerCase()}`,
      requireReason: removing,
      destructive: removing,
      run: async (reason) => {
        await client.adminSetListingStatus(listing.id, status, reason);
        await after(`Marked ${STATUS_LABELS[status].toLowerCase()}`);
      },
    });
  };

  const hardDelete = (listing: ListingWithSeller) =>
    setPending({
      title: 'Delete permanently',
      body: (
        <>
          <strong>{listing.title}</strong> and everything hanging off it — photos, conversations,
          offers and reviews about this trade — are destroyed. This cannot be undone. Removing the
          listing is almost always the right tool instead.
        </>
      ),
      confirmLabel: 'Delete permanently',
      requireReason: true,
      destructive: true,
      run: async (reason) => {
        await client.adminDeleteListing(listing.id, reason);
        await after('Listing deleted');
      },
    });

  return (
    <div className="asection">
      <div className="afilters">
        <input
          className="input input-mono asearch"
          placeholder="Search title, set or id…"
          value={filter.q}
          onChange={(e) => {
            setLimit(PAGE);
            setFilter((f) => ({ ...f, q: e.target.value }));
          }}
          aria-label="Search listings"
        />
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className="pill"
            aria-pressed={filter.status === s}
            onClick={() => {
              setLimit(PAGE);
              setFilter((f) => ({ ...f, status: s }));
            }}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
        <button
          type="button"
          className="pill"
          aria-pressed={filter.saleType === 'auction'}
          onClick={() => {
            setLimit(PAGE);
            setFilter((f) => ({ ...f, saleType: f.saleType === 'auction' ? 'all' : 'auction' }));
          }}
        >
          Auctions only
        </button>
      </div>

      {state === 'error' ? (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load listings</h3>
          <button className="btn-outline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : state === 'loading' && items.length === 0 ? (
        <div className="skeleton" style={{ height: 320 }} />
      ) : items.length === 0 ? (
        <div className="empty-dashed">
          <h3>No listings match</h3>
          <p>Loosen the filters, or search by listing id.</p>
        </div>
      ) : (
        <>
          <p className="mono-label acount">
            {items.length} of {total}
          </p>
          <ul className="acards">
            {items.map((l) => (
              <li key={l.id} className={`acard${l.status === 'removed' ? ' acard-flagged' : ''}`}>
                <div className="acard-top">
                  <Link to={`/listing/${l.id}`} className="alisting">
                    <span
                      className="alisting-thumb"
                      style={
                        l.images[0]
                          ? { backgroundImage: `url(${l.images[0].url})` }
                          : { background: thumbBackground(l.id) }
                      }
                      aria-hidden="true"
                    >
                      {!l.images[0] && glyphOf(l.title)}
                    </span>
                    <span className="alisting-id">
                      <strong>{l.title}</strong>
                      <span className="mono-label">
                        {GAME_LABELS[l.game]} · {l.setName || 'No set'} ·{' '}
                        {formatPrice(l.price, l.currency)}
                      </span>
                    </span>
                  </Link>
                  <span className="acard-flags">
                    <Chip tone={STATUS_TONE[l.status]}>{STATUS_LABELS[l.status]}</Chip>
                    {l.saleType === 'auction' && <Chip tone="warn">Auction</Chip>}
                  </span>
                </div>

                <p className="mono-label acard-meta">
                  {handleOf(l.seller)} · listed {relativeTime(l.createdAt)} · {l.likes} watching
                </p>

                <div className="acard-actions">
                  <label className="asetstatus">
                    <span className="mono-label">Force status</span>
                    <select
                      className="input input-mono"
                      value=""
                      onChange={(e) => {
                        const next = e.target.value as ListingStatus;
                        e.target.value = '';
                        if (next) changeStatus(l, next);
                      }}
                    >
                      <option value="">Choose…</option>
                      {(['active', 'reserved', 'sold', 'removed'] as ListingStatus[])
                        .filter((s) => s !== l.status)
                        .map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                    </select>
                  </label>
                  {l.status === 'removed' ? (
                    <button
                      type="button"
                      className="btn-acid"
                      onClick={() => changeStatus(l, 'active')}
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-outline btn-danger-outline"
                      onClick={() => changeStatus(l, 'removed')}
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-outline btn-danger-outline"
                    onClick={() => hardDelete(l)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {items.length < total && (
        <div className="amore">
          <button type="button" className="btn-outline" onClick={() => setLimit((n) => n + PAGE)}>
            Show more
          </button>
        </div>
      )}

      {pending && (
        <ReasonPrompt
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          requireReason={pending.requireReason}
          destructive={pending.destructive}
          onConfirm={pending.run}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
