import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ListingScreen, ReviewQueueItem } from '../../lib/types';
import { GAME_LABELS, WARNING_LIMIT } from '../../lib/types';
import { formatPrice, relativeTime } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { ReasonPrompt } from './ReasonPrompt';
import { Chip, handleOf } from './shared';

const VERDICT: Record<NonNullable<ListingScreen['verdict']>, { label: string; tone: 'acid' | 'danger' | 'warn' | 'plain' }> = {
  card: { label: 'Check: card', tone: 'acid' },
  not_card: { label: 'Check: not a card', tone: 'danger' },
  unsure: { label: 'Check: unsure', tone: 'warn' },
  error: { label: 'Check failed', tone: 'plain' },
};

interface Pending {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  requireReason: boolean;
  destructive: boolean;
  run(reason: string): Promise<void>;
}

/**
 * Listings that aren't public yet (migration 0031): the photo check
 * wasn't sure, said no, couldn't run, or the seller added photos after a
 * rejection. Oldest first, photos large enough to judge.
 */
export function AdminReviewQueue({ onChanged }: { onChanged(): void }) {
  const { client } = useApp();
  const toast = useToast();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setItems(await client.adminListReviewQueue());
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const after = async (message: string) => {
    toast(message);
    onChanged();
    await load();
  };

  const approve = (item: ReviewQueueItem) =>
    setPending({
      title: 'Approve listing',
      body: (
        <>
          <strong>{item.listing.title}</strong> goes live now and {handleOf(item.seller)} is told.
          {item.listing.saleType === 'auction' &&
            ' Its auction gets back the time it spent waiting.'}
        </>
      ),
      confirmLabel: 'Approve',
      requireReason: false,
      destructive: false,
      run: async (reason) => {
        await client.adminReviewListing(item.listing.id, true, reason);
        await after('Approved — the listing is live');
      },
    });

  const reject = (item: ReviewQueueItem, warn: boolean) =>
    setPending({
      title: warn ? 'Reject and warn the seller' : 'Reject listing',
      body: (
        <>
          <strong>{item.listing.title}</strong> stays hidden and {handleOf(item.seller)} sees your
          reason.
          {item.listing.saleType === 'auction' && ' Its auction is cancelled.'}
          {warn &&
            ` They also get a warning naming this listing; ${WARNING_LIMIT} active warnings suspend the account.`}
        </>
      ),
      confirmLabel: warn ? 'Reject and warn' : 'Reject',
      requireReason: true,
      destructive: true,
      run: async (reason) => {
        await client.adminReviewListing(item.listing.id, false, reason);
        if (warn) {
          const n = await client.adminWarnUser(item.listing.sellerId, reason, item.listing.id);
          await after(
            n >= WARNING_LIMIT ? 'Rejected — account suspended' : `Rejected — warning ${n} of ${WARNING_LIMIT}`,
          );
        } else {
          await after('Rejected');
        }
      },
    });

  return (
    <div className="asection">
      <p className="mono-label acount">
        New listings go live once a quick check confirms the photos show a card. These are the ones
        it couldn&apos;t confirm — oldest first.
      </p>

      {state === 'error' ? (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load the queue</h3>
          <button className="btn-outline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : state === 'loading' && items.length === 0 ? (
        <div className="skeleton" style={{ height: 320 }} />
      ) : items.length === 0 ? (
        <div className="empty-dashed">
          <h3>Nothing waiting</h3>
          <p>Every listing has been checked.</p>
        </div>
      ) : (
        <ul className="acards">
          {items.map((item) => {
            const l = item.listing;
            const last = item.screens[0];
            return (
              <li key={l.id} className="acard areview">
                <div className="acard-top">
                  <span className="alisting-id">
                    <Link to={`/listing/${l.id}`}>
                      <strong>{l.title}</strong>
                    </Link>
                    <span className="mono-label">
                      {GAME_LABELS[l.game]} · {l.setName || 'No set'} · {formatPrice(l.price, l.currency)}
                    </span>
                  </span>
                  <span className="acard-flags">
                    {last?.verdict ? (
                      <Chip tone={VERDICT[last.verdict].tone}>{VERDICT[last.verdict].label}</Chip>
                    ) : (
                      <Chip>Not checked</Chip>
                    )}
                    {l.saleType === 'auction' && <Chip tone="warn">Auction</Chip>}
                  </span>
                </div>

                {l.images.length > 0 ? (
                  <div className="areview-photos">
                    {l.images.map((img, i) => (
                      <a
                        key={img.id}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="areview-photo"
                        aria-label={`Photo ${i + 1} of ${l.images.length}, full size`}
                      >
                        <img src={img.url} alt="" loading="lazy" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mono-label">No photos.</p>
                )}

                {last?.reason && <p className="areview-reason">{last.reason}</p>}
                {l.description && <p className="areview-desc">{l.description}</p>}

                <p className="mono-label acard-meta">
                  {handleOf(item.seller)} · listed {relativeTime(l.createdAt)}
                  {item.screens.length > 1 && ` · checked ${item.screens.length} times`}
                </p>

                <div className="acard-actions">
                  <button type="button" className="btn-acid" onClick={() => approve(item)}>
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-outline btn-danger-outline"
                    onClick={() => reject(item, false)}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-outline btn-danger-outline"
                    onClick={() => reject(item, true)}
                  >
                    Reject &amp; warn
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pending && (
        <ReasonPrompt
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          requireReason={pending.requireReason}
          reasonLabel={pending.requireReason ? 'Reason (the seller sees this)' : 'Note (optional)'}
          placeholder={
            pending.requireReason
              ? 'e.g. The photos don’t show a trading card.'
              : 'Anything worth keeping in the audit log'
          }
          destructive={pending.destructive}
          onConfirm={pending.run}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
