import { useCallback, useEffect, useState } from 'react';
import type { Plan, PurchaseRequest, PurchaseStatus } from '../../lib/types';
import { formatPrice, relativeTime } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { ReasonPrompt } from './ReasonPrompt';
import { Chip } from './shared';

const STATUSES: PurchaseStatus[] = ['pending', 'active', 'rejected', 'expired', 'cancelled'];

/**
 * The billing queue. Nothing is charged in the app: someone pays by OMT,
 * Whish or bank transfer and a moderator confirms it here, which is the
 * same function a payment webhook would call later. Every approval and
 * grant writes an audit row.
 */
export function AdminBilling({ onChanged }: { onChanged(): void }) {
  const { client } = useApp();
  const toast = useToast();
  const [status, setStatus] = useState<PurchaseStatus>('pending');
  const [rows, setRows] = useState<PurchaseRequest[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [deciding, setDeciding] = useState<{ row: PurchaseRequest; approve: boolean } | null>(
    null,
  );

  const load = useCallback(async () => {
    setState('loading');
    try {
      setRows(await client.adminListPurchases(status));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    client
      .listPlans()
      .then(setPlans)
      .catch(() => {});
  }, [client]);

  const planLabel = (code: string | null) =>
    code ? (plans.find((p) => p.code === code)?.label ?? code) : 'Custom grant';

  return (
    <div className="asection">
      <div className="afilters">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className="pill"
            aria-pressed={s === status}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="abilling-note">
        Money moves outside the app. Approve once the transfer has landed — approving a
        subscription opens its period from now, approving a listing pack hands the listings over.
      </p>

      {state === 'error' ? (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load the billing queue</h3>
          <button className="btn-outline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : state === 'loading' && rows.length === 0 ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : rows.length === 0 ? (
        <div className="empty-dashed">
          <h3>Nothing {status}</h3>
          <p>
            {status === 'pending'
              ? 'No one is waiting on a confirmation right now.'
              : 'Nothing in this state yet.'}
          </p>
        </div>
      ) : (
        <ul className="acards">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="acard">
              <div className="acard-top">
                <Chip tone={r.kind === 'subscription' ? 'acid' : 'plain'}>{r.kind}</Chip>
                <span className="mono-label acard-when">{relativeTime(r.createdAt)}</span>
              </div>

              <p className="acard-detail">
                <strong>{planLabel(r.planCode)}</strong>
                {r.credits ? ` · ${r.credits} listings` : ''}
                {r.priceUsd !== null ? ` · ${formatPrice(r.priceUsd, 'USD')}` : ''}
              </p>

              {r.note && <p className="acard-detail abilling-paynote">“{r.note}”</p>}

              <p className="mono-label acard-meta">
                {r.username ? `@${r.username}` : r.displayName} · {r.status}
              </p>

              {r.status === 'pending' && (
                <div className="acard-actions">
                  <button
                    type="button"
                    className="btn-acid"
                    onClick={() => setDeciding({ row: r, approve: true })}
                  >
                    Payment landed — switch on
                  </button>
                  <button
                    type="button"
                    className="btn-outline btn-danger-outline"
                    onClick={() => setDeciding({ row: r, approve: false })}
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deciding && (
        <ReasonPrompt
          title={deciding.approve ? 'Switch this purchase on' : 'Reject this request'}
          body={
            deciding.approve ? (
              <>
                {deciding.row.username ? `@${deciding.row.username}` : deciding.row.displayName}{' '}
                gets {planLabel(deciding.row.planCode)}
                {deciding.row.kind === 'subscription'
                  ? ' — unlimited listings and Pre-Grade from now until the period ends.'
                  : ` — ${deciding.row.credits} listings, which never expire.`}{' '}
                Only do this once you can see the payment.
              </>
            ) : (
              <>
                The request closes and nothing is granted. They can ask again. Say why, so the
                audit row makes sense later.
              </>
            )
          }
          confirmLabel={deciding.approve ? 'Switch on' : 'Reject'}
          requireReason={!deciding.approve}
          reasonLabel={deciding.approve ? 'Payment reference' : 'Reason'}
          placeholder={
            deciding.approve ? 'OMT ref, transfer id, who confirmed it…' : 'No payment received…'
          }
          destructive={!deciding.approve}
          onConfirm={async (reason) => {
            await client.adminReviewPurchase(
              deciding.row.kind,
              deciding.row.id,
              deciding.approve,
              reason,
            );
            toast(deciding.approve ? 'Purchase switched on' : 'Request rejected');
            onChanged();
            await load();
          }}
          onClose={() => setDeciding(null)}
        />
      )}
    </div>
  );
}
