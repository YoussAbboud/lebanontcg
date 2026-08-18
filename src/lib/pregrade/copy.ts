// Copy rules for the pre-grade feature, in one place: bands with
// confidence (never a bare number), advice-not-verdict recommendations,
// findings in collector language, and the honest sentence for anything
// that wasn't assessed.

import type { EvVerdict } from './ev';
import type {
  CornerFinding,
  EdgeFinding,
  Estimate,
  FindingSeverity,
  Recommendation,
  SurfaceFinding,
} from './types';

export function confidenceLabel(c: Estimate['confidence']): string {
  return c === 'high' ? 'High confidence' : c === 'moderate' ? 'Moderate confidence' : 'Low confidence';
}

function likelyRange(e: Pick<Estimate, 'band' | 'base'>): string {
  const probs: Array<[string, number]> = [
    ['10', e.band.p10],
    ['9', e.band.p9],
    ['8', e.band.p8],
    ['≤7', e.band.pLow],
  ];
  const likely = probs.filter(([, p]) => p >= 0.15).map(([g]) => g);
  return likely.length === 0
    ? String(e.base)
    : likely.length === 1
      ? likely[0]
      : `${likely[likely.length - 1]}–${likely[0]}`;
}

/** e.g. "Est. PSA 9–10 · Moderate confidence" — never a bare number. */
export function bandLabel(e: Estimate): string {
  if (e.recommendation === 'inconclusive' && !e.isCeiling) return 'Not enough to go on';
  if (e.isCeiling) return `Up to PSA ${e.base} · surface not checked`;
  return `Est. PSA ${likelyRange(e)} · ${confidenceLabel(e.confidence)}`;
}

/**
 * The small listing-card pill, e.g. "EST. 9–10". Null for abstained
 * reports. Rendered subordinate to a real slab badge, never in acid.
 */
export function pregradePillLabel(
  e: Pick<Estimate, 'band' | 'base' | 'isCeiling' | 'recommendation'>,
): string | null {
  if (e.recommendation === 'inconclusive' && !e.isCeiling) return null;
  if (e.isCeiling) return `UP TO ${e.base}`;
  return `EST. ${likelyRange(e)}`;
}

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  submit: 'Worth submitting',
  marginal: 'Marginal — inside the noise',
  do_not_submit: "Don't submit this one",
  inconclusive: 'Not enough to go on',
};

export const EV_VERDICT_LABELS: Record<EvVerdict, string> = {
  worth_submitting: 'Worth submitting',
  marginal: 'Marginal — inside the noise',
  sell_raw: 'Sell it raw',
};

const SEVERITY_ADJ: Record<FindingSeverity, string> = {
  trace: 'Trace',
  minor: 'Light',
  moderate: 'Noticeable',
  severe: 'Heavy',
};

const CORNER_NOUN: Record<CornerFinding['type'], string> = {
  soft: 'softness',
  ding: 'ding',
  whitening: 'whitening',
  fray: 'fraying',
  round: 'rounding',
};
const CORNER_LOC: Record<CornerFinding['location'], string> = {
  top_left: 'top-left',
  top_right: 'top-right',
  bottom_right: 'bottom-right',
  bottom_left: 'bottom-left',
};

const EDGE_NOUN: Record<EdgeFinding['type'], string> = {
  factory_cut: 'rough factory cut',
  fuzz: 'edge fuzz',
  whitening: 'edge whitening',
  chip: 'chipping',
  bleed_into_surface: 'chipping that bleeds into the printed surface',
};

const SURFACE_NOUN: Record<SurfaceFinding['type'], string> = {
  print_line: 'print line',
  scratch: 'scratch',
  dimple: 'factory dimple',
  indent: 'indent',
  stain: 'stain',
  gloss_break: 'gloss break',
};

export function cornerSentence(f: CornerFinding): string {
  return `${SEVERITY_ADJ[f.severity]} ${CORNER_NOUN[f.type]} on the ${CORNER_LOC[f.location]} corner`;
}
export function edgeSentence(f: EdgeFinding): string {
  return `${SEVERITY_ADJ[f.severity]} ${EDGE_NOUN[f.type]} along the ${f.location} edge`;
}
export function surfaceSentence(f: SurfaceFinding): string {
  return `${SEVERITY_ADJ[f.severity]} ${SURFACE_NOUN[f.type]} on the ${f.face}`;
}

export const SURFACE_NOT_CHECKED =
  "Surface wasn't checked — no raking-light photos. Anything under the gloss is invisible in the shots you gave.";

export const INDENT_WARNING =
  'Looks like an indent. Indents almost always cap a card at 8. Check it under a lamp before you spend the submission fee.';

export const AUTHENTICITY_NOTE =
  "Something about this card's stock or gloss reads unusual in these photos. Worth a second look in person.";

export const PRIOR_NOTE =
  'These percentages are priors, not measured results — reported grading outcomes replace them over time.';

/** Shown once a bucket has ≥30 real outcomes behind it. */
export function trackRecordSentence(count: number, p10Rate: number): string {
  return `Estimates like this one have come back as a 10 in ${Math.round(p10Rate * 100)}% of ${count} reported submissions.`;
}

/** Break-even sentence in plain terms. */
export function breakEvenSentence(breakEvenP10: number | null, p10: number): string {
  if (breakEvenP10 === null) return '';
  return `This only pays off if it 10s more than ${Math.round(breakEvenP10 * 100)}% of the time. Your estimate says ${Math.round(p10 * 100)}%.`;
}
