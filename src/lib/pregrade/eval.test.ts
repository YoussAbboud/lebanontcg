// `npm run pregrade:eval` — the whole pipeline, headless, over the
// fixture set with known outcomes. Prints mean absolute grade error,
// the P(10) Brier score, and — the metric that actually matters — the
// FALSE-CONFIDENT RATE: the share of high-confidence `submit`
// recommendations that came back ≤ 8. Target: under 5%. Runs in CI as
// part of the normal test suite so a regression can't land silently.

import { describe, expect, it } from 'vitest';
import {
  correctPerspective,
  detectCardQuad,
  detectInnerBorders,
  ratiosFromBorders,
  scoreFrontCentering,
} from './centering';
import { estimateGrade } from './estimate';
import { EVAL_SET } from './evalset';
import { generateCard } from './fixtures';
import { MOCK_ASSESSMENTS } from './mockAssessments';

interface EvalRow {
  name: string;
  base: number;
  p10: number;
  confidence: string;
  recommendation: string;
  actual: number;
}

function runPipeline(): EvalRow[] {
  return EVAL_SET.map((c) => {
    const fix = generateCard({ lr: c.lr, tb: c.tb, seed: c.seed });
    const quad = detectCardQuad(fix.image);
    if (!quad) throw new Error(`quad detection failed for ${c.name}`);
    const card = correctPerspective(fix.image, quad.quad);
    const borders = detectInnerBorders(card);
    if (!borders) throw new Error(`border detection failed for ${c.name}`);
    const ratios = ratiosFromBorders(borders);
    const assessment = MOCK_ASSESSMENTS[c.assess]();
    if (!c.hasRake) {
      assessment.surface = { score: null, confidence: 'not_assessed', borderline: false, findings: [] };
    }
    const estimate = estimateGrade({
      centering: scoreFrontCentering(ratios),
      corners: assessment.corners.score,
      edges: assessment.edges.score,
      surface: assessment.surface.confidence === 'not_assessed' ? null : assessment.surface.score,
      assessment,
      era: c.era,
      centeringMethod: 'border_detect',
      allImagesPassedQuality: true,
    });
    return {
      name: c.name,
      base: estimate.base,
      p10: estimate.band.p10,
      confidence: estimate.confidence,
      recommendation: estimate.recommendation,
      actual: c.actual,
    };
  });
}

describe('pregrade:eval — pipeline metrics over the fixture set', () => {
  const rows = runPipeline();

  it('reports MAE, Brier and the false-confident rate', () => {
    const mae = rows.reduce((s, r) => s + Math.abs(r.base - r.actual), 0) / rows.length;
    const brier =
      rows.reduce((s, r) => s + (r.p10 - (r.actual === 10 ? 1 : 0)) ** 2, 0) / rows.length;
    const confidentSubmits = rows.filter(
      (r) => r.confidence === 'high' && r.recommendation === 'submit',
    );
    const falseConfident = confidentSubmits.filter((r) => r.actual <= 8);
    const fcRate = confidentSubmits.length ? falseConfident.length / confidentSubmits.length : 0;

    // The confusion matrix, band vs actual.
    const bands = ['10', '9', '8', '≤7'];
    const bandOf = (g: number) => (g >= 10 ? '10' : g === 9 ? '9' : g === 8 ? '8' : '≤7');
    const matrix: Record<string, Record<string, number>> = {};
    for (const p of bands) matrix[p] = Object.fromEntries(bands.map((a) => [a, 0]));
    for (const r of rows) matrix[bandOf(r.base)][bandOf(r.actual)]++;

    console.log('\n=== pregrade:eval ===');
    console.log(`cases:                ${rows.length}`);
    console.log(`mean absolute error:  ${mae.toFixed(2)} grades`);
    console.log(`P(10) Brier score:    ${brier.toFixed(3)}`);
    console.log(
      `false-confident rate: ${(fcRate * 100).toFixed(1)}% (${falseConfident.length}/${confidentSubmits.length} high-confidence submits came back ≤ 8) — target < 5%`,
    );
    console.log('confusion (predicted base band → actual):');
    for (const p of bands) {
      console.log(`  ${p.padStart(3)} → ${bands.map((a) => `${a}:${matrix[p][a]}`).join('  ')}`);
    }

    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(mae).toBeLessThanOrEqual(1.0);
    expect(fcRate).toBeLessThan(0.05);
  });

  it('never counts a ceiling or abstention as a confident submit', () => {
    for (const r of rows) {
      if (r.recommendation === 'inconclusive') {
        expect(r.confidence).not.toBe('high');
      }
    }
  });
});
