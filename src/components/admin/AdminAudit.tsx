import { useCallback, useEffect, useState } from 'react';
import type { AdminAction } from '../../lib/types';
import { ADMIN_ACTION_LABELS } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { Chip, detailSummary, handleOf } from './shared';

const PAGE = 50;

/** Actions that took something away read in the danger tone. */
const DESTRUCTIVE = new Set<AdminAction['kind']>([
  'user_suspend',
  'user_demote',
  'listing_delete',
  'auction_cancel',
  'review_delete',
]);

export function AdminAudit() {
  const { client } = useApp();
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<AdminAction[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setRows(await client.adminListActions(limit));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'error') {
    return (
      <div className="empty-dashed">
        <h3>Couldn&apos;t load the log</h3>
        <button className="btn-outline" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="asection">
      <p className="aexplain">
        Every admin action, append-only. Nothing in this app can edit or delete a row here —
        including the admin who wrote it.
      </p>

      {state === 'loading' && rows.length === 0 ? (
        <div className="skeleton" style={{ height: 320 }} />
      ) : rows.length === 0 ? (
        <div className="empty-dashed">
          <h3>Nothing logged yet</h3>
          <p>The first suspension, removal or promotion will show up here.</p>
        </div>
      ) : (
        <ul className="alog">
          {rows.map((a) => (
            <li key={a.id} className="alog-row">
              <div className="alog-head">
                <Chip tone={DESTRUCTIVE.has(a.kind) ? 'danger' : 'plain'}>
                  {ADMIN_ACTION_LABELS[a.kind]}
                </Chip>
                <span className="alog-actor">{handleOf(a.actor)}</span>
                <span className="mono-label alog-when">{relativeTime(a.createdAt)}</span>
              </div>
              <p className="mono-label alog-target">
                {a.targetType} {a.targetId}
                {detailSummary(a.detail) && ` · ${detailSummary(a.detail)}`}
              </p>
              {a.reason && <p className="acard-note">“{a.reason}”</p>}
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
    </div>
  );
}
