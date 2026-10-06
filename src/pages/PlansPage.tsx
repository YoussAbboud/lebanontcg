import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Plan } from '../lib/types';
import { freeListingsLeft } from '../lib/types';
import { formatPrice } from '../lib/format';
import { useApp } from '../state/AppContext';
import './plans.css';

/** Why there's a wall at all. Said once, plainly, where people meet it. */
export const OPERATIONS_LINE =
  'Listing fees keep our operations running smoothly — the servers, the image storage and the Pre-Grade analysis all cost real money, and nothing is taken out of your sales.';

function periodLabel(plan: Plan): string {
  if (plan.kind !== 'subscription') return 'one-off';
  return plan.periodMonths === 12 ? 'per year' : 'per month';
}

export function PlansPage() {
  const { client, user, entitlements, refreshEntitlements } = useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    client
      .listPlans()
      .then((rows) => {
        if (!cancelled) setPlans(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const left = freeListingsLeft(entitlements);
  const subs = plans.filter((p) => p.kind === 'subscription');
  const packs = plans.filter((p) => p.kind === 'credits');

  const request = async () => {
    if (!chosen) return;
    setState('busy');
    setError('');
    try {
      await client.requestPurchase(chosen.code, note.trim());
      setState('sent');
      refreshEntitlements();
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'That request was rejected.');
    }
  };

  const planCard = (plan: Plan) => (
    <li
      key={plan.code}
      className={`plans-card panel${plan.code === 'yearly' ? ' is-featured' : ''}`}
    >
      {plan.code === 'yearly' && <span className="plans-flag">Best value</span>}
      <h3>{plan.label}</h3>
      <p className="plans-price mono-value">
        {formatPrice(plan.priceUsd, 'USD')}
        <span className="plans-period">{periodLabel(plan)}</span>
      </p>
      <p className="plans-blurb">{plan.blurb}</p>
      <ul className="plans-features">
        {plan.kind === 'subscription' ? (
          <>
            <li>Unlimited listings</li>
            <li>Pre-Grade estimator included</li>
            <li>Cancel any time — it just lapses</li>
          </>
        ) : (
          <>
            <li>{plan.credits} extra listings</li>
            <li>They never expire</li>
            <li>No subscription, no Pre-Grade</li>
          </>
        )}
      </ul>
      <button
        type="button"
        className={plan.code === 'yearly' ? 'btn-acid plans-pick' : 'btn-outline plans-pick'}
        onClick={() => {
          setChosen(plan);
          setState('idle');
          setError('');
          setNote('');
        }}
      >
        {plan.kind === 'subscription' ? 'Subscribe' : 'Buy listings'}
      </button>
    </li>
  );

  return (
    <main className="plans">
      <header className="plans-hero">
        <h1 className="display plans-title">
          Three listings free, <span className="hero-grad-text">then your call</span>
        </h1>
        <p className="plans-lede">{OPERATIONS_LINE}</p>
      </header>

      {user && entitlements && (
        <section className="plans-standing panel" aria-label="Your plan">
          {entitlements.isAdmin ? (
            <p>
              You're on the moderation team — listings and Pre-Grade are unlimited for you.
            </p>
          ) : entitlements.subscribed ? (
            <p>
              <strong>Subscribed{entitlements.tier ? ` — ${entitlements.tier}` : ''}.</strong>{' '}
              Unlimited listings and Pre-Grade.
              {entitlements.periodEnd
                ? ` Renews ${new Date(entitlements.periodEnd).toLocaleDateString()}.`
                : ''}
            </p>
          ) : (
            <p>
              <strong>
                {left === 0
                  ? 'Your free listings are used.'
                  : `${left} free listing${left === 1 ? '' : 's'} left.`}
              </strong>{' '}
              {entitlements.creditsRemaining > 0
                ? `Plus ${entitlements.creditsRemaining} bought listing${entitlements.creditsRemaining === 1 ? '' : 's'} in hand.`
                : 'Pre-Grade needs a subscription.'}
            </p>
          )}
          {entitlements.pendingRequests > 0 && (
            <p className="plans-pending">
              {entitlements.pendingRequests} request
              {entitlements.pendingRequests === 1 ? '' : 's'} waiting on us to confirm your
              payment. We'll switch it on as soon as it lands.
            </p>
          )}
        </section>
      )}

      {loading ? (
        <p className="plans-loading">Loading plans…</p>
      ) : (
        <>
          <h2 className="plans-group-title">Subscriptions</h2>
          <ul className="plans-grid">{subs.map(planCard)}</ul>
          <h2 className="plans-group-title">Or just buy a few listings</h2>
          <ul className="plans-grid">{packs.map(planCard)}</ul>
        </>
      )}

      {chosen && (
        <section className="plans-request panel" aria-label={`Request ${chosen.label}`}>
          {state === 'sent' ? (
            <>
              <h2>Request sent — {chosen.label}</h2>
              <p>
                Send {formatPrice(chosen.priceUsd, 'USD')} by OMT, Whish or bank transfer, then
                we'll switch it on. You'll see it live here the moment we confirm it.
              </p>
              <button type="button" className="btn-outline" onClick={() => setChosen(null)}>
                Done
              </button>
            </>
          ) : (
            <>
              <h2>{chosen.label} — {formatPrice(chosen.priceUsd, 'USD')}</h2>
              <p className="plans-howto">
                We don't take card payments yet: money moves the way it actually moves here —
                OMT, Whish or a bank transfer. Tell us what you sent and we'll turn it on.
              </p>
              {!user ? (
                <Link to="/signin" className="btn-acid">
                  Sign in to continue
                </Link>
              ) : (
                <>
                  <label className="plans-note-label" htmlFor="plans-note">
                    Payment reference or how you'd like to pay
                  </label>
                  <input
                    id="plans-note"
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="OMT ref 123456, or: I'll transfer today"
                    maxLength={200}
                  />
                  {error && <p className="plans-error">{error}</p>}
                  <div className="plans-actions">
                    <button
                      type="button"
                      className="btn-acid"
                      onClick={() => void request()}
                      disabled={state === 'busy'}
                    >
                      {state === 'busy' ? 'Sending…' : 'Send request'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setChosen(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      <footer className="plans-footer">
        <p>
          Nothing here is a cut of your sales — LebanonTCG never touches the money between a
          buyer and a seller. <Link to="/safety">How deals work</Link>.
        </p>
      </footer>
    </main>
  );
}
