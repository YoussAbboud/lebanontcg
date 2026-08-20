import { useCallback, useEffect, useState } from 'react';
import type { AdminReview } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { ReasonPrompt } from './ReasonPrompt';
import { handleOf } from './shared';

const PAGE = 25;

export function AdminReviews({ onChanged }: { onChanged(): void }) {
  const { client } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<AdminReview[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [deleting, setDeleting] = useState<AdminReview | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setRows(await client.adminListReviews(query, limit));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, query, limit]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="asection">
      <div className="afilters">
        <input
          className="input input-mono asearch"
          placeholder="Search review text…"
          value={query}
          onChange={(e) => {
            setLimit(PAGE);
            setQuery(e.target.value);
          }}
          aria-label="Search reviews"
        />
      </div>

      {state === 'error' ? (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load reviews</h3>
          <button className="btn-outline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : state === 'loading' && rows.length === 0 ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : rows.length === 0 ? (
        <div className="empty-dashed">
          <h3>No reviews match</h3>
          <p>Reviews are written by buyers after a trade is marked sold.</p>
        </div>
      ) : (
        <ul className="acards">
          {rows.map((r) => (
            <li key={r.id} className="acard">
              <div className="acard-top">
                <span className="astars" aria-label={`${r.rating} out of 5`}>
                  {'★'.repeat(r.rating)}
                  <span className="astars-off">{'★'.repeat(5 - r.rating)}</span>
                </span>
                <span className="mono-label acard-when">{relativeTime(r.createdAt)}</span>
              </div>

              {r.body && <p className="acard-detail">{r.body}</p>}

              <p className="mono-label acard-meta">
                {handleOf(r.reviewer)} → {handleOf(r.reviewee)}
              </p>

              <div className="acard-actions">
                <button
                  type="button"
                  className="btn-outline btn-danger-outline"
                  onClick={() => setDeleting(r)}
                >
                  Delete review
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows.length >= limit && (
        <div className="amore">
          <button type="button" className="btn-outline" onClick={() => setLimit((n) => n + PAGE)}>
            Show more
          </button>
        </div>
      )}

      {deleting && (
        <ReasonPrompt
          title="Delete this review"
          body={
            <>
              The {deleting.rating}-star review of {handleOf(deleting.reviewee)} disappears and their
              public rating is recalculated without it. Use this for reviews that break the rules,
              not ones a seller dislikes.
            </>
          }
          confirmLabel="Delete review"
          requireReason
          destructive
          onConfirm={async (reason) => {
            await client.adminDeleteReview(deleting.id, reason);
            toast('Review deleted');
            onChanged();
            await load();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
