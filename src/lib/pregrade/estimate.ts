// Grade estimate: deterministic given the four sub-scores and the
// assessment findings. The lowest attribute governs; modifiers apply
// hard caps; the output is always a BAND with probabilities, never a
// bare number. When surface wasn't assessed the result is a CEILING.

import calibrationData from './calibration.json';
import type {
  DefectAssessment,
  Estimate,
  EstimateInput,
  Era,
  GradeBand,
  Recommendation,
} from './types';

interface CalibrationTable {
  version: string;
  measured: boolean;
  /** Outcome counts per bucket — written by scripts/calibrate.mjs. */
  counts?: Record<string, number>;
  buckets: Record<string, GradeBand>;
}

export const CALIBRATION = calibrationData as unknown as CalibrationTable;

export function calibrationKey(base: number, flags: number, era: Era): string {
  const b = Math.min(10, Math.max(7, base));
  // Buckets only carry flags for 8+; a base of 7 is its own story.
  const f = b <= 7 ? 0 : Math.min(2, Math.max(0, flags));
  return `${b}|${f}|${era}`;
}

export function bandFor(base: number, flags: number, era: Era): GradeBand {
  const exact = CALIBRATION.buckets[calibrationKey(base, flags, era)];
  if (exact) return exact;
  // Anything below the table's floor is dominated by the low bucket.
  return { p10: 0, p9: 0.02, p8: 0.13, pLow: 0.85 };
}

/** Count of `borderline` attribute flags — the band key's second axis. */
export function countBorderlineFlags(a: DefectAssessment | null): number {
  if (!a) return 0;
  return [a.corners, a.edges, a.surface].filter((attr) => attr.borderline).length;
}

export function estimateGrade(input: EstimateInput): Estimate {
  const notes: string[] = [];
  const a = input.assessment;

  if (a?.abstain) {
    return {
      base: 0,
      isCeiling: false,
      band: { p10: 0, p9: 0, p8: 0, pLow: 0 },
      borderlineFlags: 0,
      confidence: 'low',
      recommendation: 'inconclusive',
      notes: [a.abstainReason ?? 'Not enough to go on from these photos.'],
    };
  }

  // Back-only surface findings at ≤ minor severity lower confidence, not
  // the grade — front defects are consistently more consequential.
  let surface = input.surface;
  let backOnlyLeniency = false;
  if (
    a &&
    surface !== null &&
    surface < 10 &&
    a.surface.findings.length > 0 &&
    a.surface.findings.every(
      (f) => f.face === 'back' && (f.severity === 'trace' || f.severity === 'minor'),
    )
  ) {
    surface = 10;
    backOnlyLeniency = true;
    notes.push('Back-only minor surface findings — noted, not grade-limiting.');
  }

  const assessed = [input.centering, input.corners, input.edges].filter(
    (s): s is number => s !== null,
  );
  const surfaceAssessed = surface !== null;
  let base = Math.min(...assessed, surfaceAssessed ? (surface as number) : 10);

  // Hard caps.
  const hasIndent = a?.surface.findings.some((f) => f.type === 'indent') ?? false;
  const hasBleed = a?.edges.findings.some((f) => f.type === 'bleed_into_surface') ?? false;
  if (hasIndent) {
    base = Math.min(base, 8);
    notes.push('Indent found — indents almost always cap a card at 8.');
  }
  if (hasBleed) {
    base = Math.min(base, 8);
    notes.push('Edge damage bleeds into the printed surface — capped at 8.');
  }

  const isCeiling = !surfaceAssessed;
  if (isCeiling) {
    notes.push('Surface was not checked — no raking-light photos. This number is a ceiling, not an estimate.');
  }

  const flags = countBorderlineFlags(a);
  const band = isCeiling
    ? { p10: 0, p9: 0, p8: 0, pLow: 0 }
    : bandFor(base, flags, input.era);

  // Confidence is derived, never invented.
  const attrConfidences = a
    ? [a.corners.confidence, a.edges.confidence, a.surface.confidence]
    : [];
  const allAssessed =
    input.centering !== null && input.corners !== null && input.edges !== null && surfaceAssessed;
  let confidence: 'high' | 'moderate' | 'low';
  if (
    allAssessed &&
    input.allImagesPassedQuality &&
    input.centeringMethod === 'border_detect' &&
    !attrConfidences.includes('low') &&
    !backOnlyLeniency
  ) {
    confidence = 'high';
  } else if (attrConfidences.includes('low') || !allAssessed) {
    confidence = 'low';
  } else {
    confidence = 'moderate';
  }
  if (input.centeringMethod === 'design_element') {
    notes.push('Centering measured against a design element, not a printed border — a proxy, one confidence step down.');
  }

  // Recommendation.
  let recommendation: Recommendation;
  const doNotSubmit =
    hasIndent ||
    hasBleed ||
    (a?.surface.findings.some(
      (f) =>
        (f.type === 'scratch' && f.severity !== 'trace' && countScratches(a) > 2) ||
        (f.type === 'print_line' && f.severity === 'moderate') ||
        f.type === 'gloss_break',
    ) ??
      false);
  // "Submit" must respect the band's own downside: recommending a card
  // whose probabilities say it ≤8s a third of the time is exactly the
  // false confidence this feature exists to avoid (vintage 9s live here).
  const downside = band.p8 + band.pLow;
  if (doNotSubmit) recommendation = 'do_not_submit';
  else if (isCeiling) recommendation = 'inconclusive';
  else if (base >= 9 && downside < 0.35) recommendation = 'submit';
  else if (base >= 8) recommendation = 'marginal';
  else recommendation = 'do_not_submit';

  return { base, isCeiling, band, borderlineFlags: flags, confidence, recommendation, notes };
}

function countScratches(a: DefectAssessment): number {
  return a.surface.findings.filter((f) => f.type === 'scratch').length;
}
