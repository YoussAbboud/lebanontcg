import { useEffect, useMemo, useState } from 'react';
import { computeEv, type EvInput } from '../../lib/pregrade/ev';
import { breakEvenSentence, EV_VERDICT_LABELS } from '../../lib/pregrade/copy';
import type { Estimate } from '../../lib/pregrade/types';

const STORAGE_KEY = 'pregrade-ev-inputs';

const DEFAULTS: EvInput = {
  value10: 0,
  value9: 0,
  valueLow: 0,
  rawValue: 0,
  costBasis: 0,
  gradingFee: 25,
  shippingPerCard: 5,
  suppliesPerCard: 1,
  saleFeeRate: 0.1,
};

function load(): EvInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<EvInput>) };
  } catch {
    return DEFAULTS;
  }
}

const FIELDS: Array<{ key: keyof EvInput; label: string; hint?: string; percent?: boolean }> = [
  { key: 'value10', label: 'Value at PSA 10', hint: 'check comps yourself — nothing is scraped' },
  { key: 'value9', label: 'Value at PSA 9' },
  { key: 'valueLow', label: 'Value at PSA 8 / below' },
  { key: 'rawValue', label: 'Raw value now', hint: 'the do-nothing baseline' },
  { key: 'costBasis', label: 'Card cost basis' },
  { key: 'gradingFee', label: 'Grading fee per card' },
  { key: 'shippingPerCard', label: 'Shipping per card', hint: 'submission total ÷ cards' },
  { key: 'suppliesPerCard', label: 'Supplies per card' },
  { key: 'saleFeeRate', label: 'Sale fee rate %', percent: true },
];

/**
 * Expected value: is grading this worth more than selling it raw right
 * now? Headline is Uplift with a plain verdict. A do_not_submit report
 * can never show "Worth submitting" here, whatever the numbers say.
 */
export function EvPanel({ estimate }: { estimate: Estimate }) {
  const [inputs, setInputs] = useState<EvInput>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      // storage full/blocked — remembering inputs is best-effort
    }
  }, [inputs]);

  const usable =
    !estimate.isCeiling &&
    estimate.recommendation !== 'inconclusive' &&
    inputs.value10 > 0 &&
    inputs.rawValue > 0;

  const result = useMemo(
    () => (usable ? computeEv(estimate.band, inputs) : null),
    [usable, estimate.band, inputs],
  );

  // The report's defect verdict outranks the arithmetic.
  const forcedNo = estimate.recommendation === 'do_not_submit';
  const verdictText = forcedNo
    ? "Don't submit this one"
    : result
      ? EV_VERDICT_LABELS[result.verdict]
      : '';

  const set = (key: keyof EvInput, raw: string) => {
    const n = Number(raw);
    setInputs((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) ? (key === 'saleFeeRate' ? Math.min(0.99, Math.max(0, n / 100)) : Math.max(0, n)) : prev[key],
    }));
  };

  if (estimate.isCeiling || estimate.recommendation === 'inconclusive') {
    return (
      <section className="evpanel panel" aria-label="Expected value">
        <h3 className="mono-label">Worth grading?</h3>
        <p className="evpanel-muted">
          {estimate.isCeiling
            ? 'The math needs a real estimate, and this report is a ceiling — go back and shoot the raking-light photos first.'
            : 'No estimate to price against — the assessment abstained.'}
        </p>
      </section>
    );
  }

  return (
    <section className="evpanel panel" aria-label="Expected value">
      <h3 className="mono-label">Worth grading? Enter your numbers</h3>
      <div className="evpanel-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="evpanel-field">
            <span className="mono-label">{f.label}</span>
            <input
              className="input"
              type="number"
              min={0}
              step={f.percent ? 0.5 : 1}
              inputMode="decimal"
              value={f.percent ? Math.round(inputs[f.key] * 1000) / 10 : inputs[f.key] || ''}
              placeholder="0"
              onChange={(e) => set(f.key, e.target.value)}
            />
            {f.hint && <small className="evpanel-hint">{f.hint}</small>}
          </label>
        ))}
      </div>

      {result && (
        <div className="evpanel-result">
          <div className="evpanel-uplift">
            <span className="mono-label">Uplift vs selling raw</span>
            <strong className={`display mono-value ${result.uplift >= 0 ? 'is-up' : 'is-down'}`}>
              {result.uplift >= 0 ? '+' : '−'}${Math.abs(result.uplift).toFixed(0)}
            </strong>
            <span
              className={`evpanel-verdict mono-label ${forcedNo ? 'is-no' : `is-${result.verdict}`}`}
            >
              {verdictText}
            </span>
          </div>
          {forcedNo && (
            <p className="evpanel-forced">
              The defects cap this card regardless of the math — the report says don&apos;t spend
              the fee.
            </p>
          )}
          <div className="evpanel-rows mono-value">
            <span>EV gross ${result.evGross.toFixed(0)}</span>
            <span>EV net ${result.evNet.toFixed(0)}</span>
            <span>Raw net ${result.rawNet.toFixed(0)}</span>
            <span>Profit vs cost ${result.profit.toFixed(0)}</span>
          </div>
          {!forcedNo && result.breakEvenP10 !== null && (
            <p className="evpanel-breakeven">
              {breakEvenSentence(result.breakEvenP10, estimate.band.p10)}
            </p>
          )}
        </div>
      )}
      {!result && (
        <p className="evpanel-muted">Enter at least the PSA 10 value and the raw value.</p>
      )}
    </section>
  );
}
