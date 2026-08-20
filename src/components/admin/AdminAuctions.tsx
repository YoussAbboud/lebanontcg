import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminAuction, AuctionStatus } from '../../lib/types';
import { formatPrice, relativeTime } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { ReasonPrompt } from './ReasonPrompt';
import { Chip, handleOf } from './shared';

const FILTERS: Array<{ key: AuctionStatus | 'all'; label: string }> = [
  { key: 'live', label: 'Live' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const TONE: Record<AuctionStatus, 'plain' | 'acid' | 'danger' | 'warn'> = {
  live: 'acid',
  closed: 'plain',
  cancelled: 'danger',
};

/** "2h 14m" / "ended" — auctions are judged by how much runway is left. */
function endsIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)}d left`;
}

export function AdminAuctions({ onChanged }: { onChanged(): void }) {
  const { client } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState<AuctionStatus | 'all'>('live');
  const [rows, setRows] = useState<AdminAuction[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [cancelling, setCancelling] = useState<AdminAuction | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setRows(await client.adminListAuctions(filter));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="asection">
      <div className="afilters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="pill"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {state === 'error' ? (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load auctions</h3>
          <button className="btn-outline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : state === 'loading' ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : rows.length === 0 ? (
        <div className="empty-dashed">
          <h3>No auctions here</h3>
          <p>{filter === 'live' ? 'Nothing is running right now.' : 'Nothing in this state.'}</p>
        </div>
      ) : (
        <ul className="acards">
          {rows.map((row) => (
            <li key={row.auction.id} className="acard">
              <div className="acard-top">
                <Link to={`/listing/${row.auction.listingId}`} className="acard-link">
                  {row.listingTitle}
                </Link>
                <span className="acard-flags">
                  <Chip tone={TONE[row.auction.status]}>{row.auction.status}</Chip>
                  {row.auction.status === 'live' && <Chip>{endsIn(row.auction.endsAt)}</Chip>}
                </span>
              </div>

              <dl className="ameta">
                <div>
                  <dt className="mono-label">Seller</dt>
                  <dd>{handleOf(row.seller)}</dd>
                </div>
                <div>
                  <dt className="mono-label">Top bid</dt>
                  <dd>
                    {row.topBid === null
                      ? 'No bids'
                      : formatPrice(row.topBid, row.auction.currency)}{' '}
                    <span className="mono-label">
                      ({row.bidCount} bid{row.bidCount === 1 ? '' : 's'})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="mono-label">Reserve</dt>
                  <dd>
                    {row.auction.reservePrice === null
                      ? 'None'
                      : formatPrice(row.auction.reservePrice, row.auction.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="mono-label">
                    {row.auction.status === 'live' ? 'Ends' : 'Ended'}
                  </dt>
                  <dd>{relativeTime(row.auction.endsAt)}</dd>
                </div>
              </dl>

              {row.auction.cancelReason && (
                <p className="acard-note">Cancelled: {row.auction.cancelReason}</p>
              )}

              {row.auction.status === 'live' && (
                <div className="acard-actions">
                  <button
                    type="button"
                    className="btn-outline btn-danger-outline"
                    onClick={() => setCancelling(row)}
                  >
                    Cancel auction
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {cancelling && (
        <ReasonPrompt
          title="Cancel this auction"
          body={
            <>
              Nobody wins <strong>{cancelling.listingTitle}</strong>, the listing is removed, and all{' '}
              {cancelling.bidCount} bidder{cancelling.bidCount === 1 ? '' : 's'} get your reason in
              chat.
            </>
          }
          confirmLabel="Cancel auction"
          requireReason
          destructive
          onConfirm={async (reason) => {
            await client.adminCancelAuction(cancelling.auction.id, reason);
            toast('Auction cancelled');
            onChanged();
            await load();
          }}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
