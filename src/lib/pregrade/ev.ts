// Expected-value calculator. The question is never "is this card worth
// money" — it's "is grading it worth more than selling it raw, today".
// The headline output is Uplift, with a plain verdict.

import type { GradeBand } from './types';

export interface EvInput {
  value10: number;
  value9: number;
  /** Value at 8 or below; defaults to 0 weight for ultra-modern flows. */
  valueLow: number;
  rawValue: number;
  costBasis: number;
  gradingFee: number;
  shippingPerCard: number;
  suppliesPerCard: number;
  /** Marketplace + payment fees, 0–1. */
  saleFeeRate: number;
}

export type EvVerdict = 'worth_submitting' | 'marginal' | 'sell_raw';

export interface EvResult {
  evGross: number;
  evNet: number;
  rawNet: number;
  uplift: number;
  profit: number;
  /** P(10) at which grading breaks even vs raw; null when it never can
      (or always does) within [0, 1]. */
  breakEvenP10: number | null;
  verdict: EvVerdict;
}

export function computeEv(band: GradeBand, input: EvInput): EvResult {
  const {
    value10,
    value9,
    valueLow,
    rawValue,
    costBasis,
    gradingFee,
    shippingPerCard,
    suppliesPerCard,
    saleFeeRate,
  } = input;

  const evGross =
    band.p10 * value10 + band.p9 * value9 + (band.p8 + band.pLow) * valueLow;
  const perCardCost = gradingFee + shippingPerCard + suppliesPerCard;
  const evNet = evGross * (1 - saleFeeRate) - perCardCost;
  const rawNet = rawValue * (1 - saleFeeRate);
  const uplift = evNet - rawNet;
  const profit = evNet - costBasis;

  // Break-even P(10): redistribute the non-10 mass in the current p9 :
  // (p8 + pLow) proportion and solve EV_net(p) = Raw_net directly.
  //   EV_gross(p) = p·V10 + (1 − p)·B, with B the blended non-10 value.
  const non10 = band.p9 + band.p8 + band.pLow;
  const blended =
    non10 > 0
      ? (band.p9 * value9 + (band.p8 + band.pLow) * valueLow) / non10
      : value9; // degenerate all-10 band: assume misses land at 9
  let breakEvenP10: number | null = null;
  const denom = value10 - blended;
  if (Math.abs(denom) > 1e-9) {
    const targetGross = (rawNet + perCardCost) / (1 - saleFeeRate);
    const p = (targetGross - blended) / denom;
    if (p >= 0 && p <= 1) breakEvenP10 = p;
  }

  // Marginal = positive uplift under 25% of the total grading cost —
  // inside the noise.
  let verdict: EvVerdict;
  if (uplift <= 0) verdict = 'sell_raw';
  else if (uplift < 0.25 * perCardCost) verdict = 'marginal';
  else verdict = 'worth_submitting';

  return { evGross, evNet, rawNet, uplift, profit, breakEvenP10, verdict };
}
