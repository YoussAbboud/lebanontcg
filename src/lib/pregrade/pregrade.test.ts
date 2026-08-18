import { describe, expect, it } from 'vitest';
import {
  correctPerspective,
  detectCardQuad,
  detectInnerBorders,
  perspectiveDeviation,
  ratiosFromBorders,
  scoreBackCentering,
  scoreFrontCentering,
  worseAxis,
} from './centering';
import { generateCard } from './fixtures';
import { bandFor, countBorderlineFlags, estimateGrade } from './estimate';
import { computeEv } from './ev';
import { frontCenteringScore, backCenteringScore, isSuperseded, CURRENT_STANDARD } from './standards';
import type { DefectAssessment, EstimateInput } from './types';

// ---------------------------------------------------------------------------
// Centering: measured within ±1.5% of ground truth across 50 generated
// cards, including inverted (dark-card) and keystoned variants.
// ---------------------------------------------------------------------------

function measure(spec: Parameters<typeof generateCard>[0]) {
  const fix = generateCard(spec);
  const quad = detectCardQuad(fix.image);
  expect(quad, `quad detection failed for ${JSON.stringify(spec)}`).not.toBeNull();
  const card = correctPerspective(fix.image, quad!.quad);
  const borders = detectInnerBorders(card);
  expect(borders, `border detection failed for ${JSON.stringify(spec)}`).not.toBeNull();
  return { ratios: ratiosFromBorders(borders!), quad: quad!, truth: fix.truth };
}

describe('centering engine', () => {
  it('measures 50 generated cards within ±1.5% of ground truth', () => {
    const lrs = [50, 52.5, 55, 57.5, 60, 62.5, 65, 70, 75, 80];
    const tbs = [50, 55, 60, 65, 70];
    let count = 0;
    let worst = 0;
    for (let i = 0; i < 50; i++) {
      const spec = {
        lr: lrs[i % lrs.length],
        tb: tbs[i % tbs.length],
        inverted: i % 3 === 0,
        keystonePx: i % 5 === 0 ? 3 : 0,
        seed: 1000 + i,
      };
      const { ratios, truth } = measure(spec);
      const errLr = Math.abs(ratios.leftRight[0] - truth.lr);
      const errTb = Math.abs(ratios.topBottom[0] - truth.tb);
      worst = Math.max(worst, errLr, errTb);
      expect(errLr, `LR error for ${JSON.stringify(spec)}`).toBeLessThanOrEqual(1.5);
      expect(errTb, `TB error for ${JSON.stringify(spec)}`).toBeLessThanOrEqual(1.5);
      count++;
    }
    expect(count).toBe(50);
    expect(worst).toBeLessThanOrEqual(1.5);
  });

  it('finds the quad but no inner border on a borderless card', () => {
    const fix = generateCard({ lr: 55, tb: 55, borderless: true, seed: 3 });
    const quad = detectCardQuad(fix.image);
    expect(quad).not.toBeNull();
    expect(quad!.aspectOk).toBe(true);
    const card = correctPerspective(fix.image, quad!.quad);
    expect(detectInnerBorders(card)).toBeNull();
  });

  it('reports keystone as perspective deviation', () => {
    const flat = generateCard({ lr: 55, tb: 55, seed: 4 });
    const skewed = generateCard({ lr: 55, tb: 55, keystonePx: 30, seed: 4 });
    expect(perspectiveDeviation(flat.quad)).toBeLessThan(0.01);
    expect(perspectiveDeviation(skewed.quad)).toBeGreaterThan(0.04);
  });

  it('the worse axis governs the sub-score', () => {
    const r = { leftRight: [54.0, 46.0] as [number, number], topBottom: [63.0, 37.0] as [number, number] };
    expect(worseAxis(r)).toBe(63);
    expect(scoreFrontCentering(r)).toBe(8);
    expect(scoreBackCentering(r)).toBe(10);
  });
});

describe('centering standards', () => {
  it('maps the published bands', () => {
    expect(frontCenteringScore(55)).toBe(10);
    expect(frontCenteringScore(55.1)).toBe(9);
    expect(frontCenteringScore(60)).toBe(9);
    expect(frontCenteringScore(65)).toBe(8);
    expect(frontCenteringScore(70)).toBe(7);
    expect(frontCenteringScore(75)).toBe(6);
    expect(frontCenteringScore(80)).toBe(5);
    expect(frontCenteringScore(90)).toBe(4);
    expect(frontCenteringScore(95)).toBe(3);
    expect(backCenteringScore(75)).toBe(10);
    expect(backCenteringScore(90)).toBe(9);
    expect(backCenteringScore(95)).toBe(8);
  });
  it('knows the current version is not superseded', () => {
    expect(isSuperseded(CURRENT_STANDARD.version)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Estimate: base = min(attrs), modifiers, ceiling, bands
// ---------------------------------------------------------------------------

const cleanAssessment = (): DefectAssessment => ({
  corners: { score: 10, confidence: 'high', borderline: false, findings: [] },
  edges: { score: 10, confidence: 'high', borderline: false, findings: [] },
  surface: { score: 10, confidence: 'high', borderline: false, findings: [] },
  authenticityFlags: [],
  imageQualityNotes: [],
  abstain: false,
  abstainReason: null,
});

const baseInput = (over: Partial<EstimateInput>): EstimateInput => ({
  centering: 10,
  corners: 10,
  edges: 10,
  surface: 10,
  assessment: cleanAssessment(),
  era: 'ultra_modern',
  centeringMethod: 'border_detect',
  allImagesPassedQuality: true,
  ...over,
});

describe('estimateGrade', () => {
  it('lowest attribute governs: flawless card at 65/35 is an 8', () => {
    const e = estimateGrade(baseInput({ centering: 8 }));
    expect(e.base).toBe(8);
  });

  it('clean ultra-modern gem hits the seeded prior', () => {
    const e = estimateGrade(baseInput({}));
    expect(e.base).toBe(10);
    expect(e.band.p10).toBeCloseTo(0.6);
    expect(e.confidence).toBe('high');
    expect(e.recommendation).toBe('submit');
    expect(e.isCeiling).toBe(false);
  });

  it('an indent hard-caps at 8 and forces do_not_submit', () => {
    const a = cleanAssessment();
    a.surface.score = 8;
    a.surface.findings.push({ face: 'back', type: 'indent', severity: 'moderate', note: '' });
    const e = estimateGrade(baseInput({ assessment: a, surface: 8 }));
    expect(e.base).toBe(8);
    expect(e.recommendation).toBe('do_not_submit');
    expect(e.notes.join(' ')).toMatch(/indent/i);
  });

  it('edge bleed into the surface hard-caps at 8', () => {
    const a = cleanAssessment();
    a.edges.score = 8;
    a.edges.findings.push({ location: 'top', type: 'bleed_into_surface', severity: 'moderate', note: '' });
    const e = estimateGrade(baseInput({ assessment: a, edges: 8 }));
    expect(e.base).toBe(8);
    expect(e.recommendation).toBe('do_not_submit');
  });

  it('dimples never cap', () => {
    const a = cleanAssessment();
    a.surface.findings.push(
      { face: 'front', type: 'dimple', severity: 'minor', note: '' },
      { face: 'back', type: 'dimple', severity: 'minor', note: '' },
    );
    const e = estimateGrade(baseInput({ assessment: a }));
    expect(e.base).toBe(10);
    expect(e.recommendation).toBe('submit');
  });

  it('back-only minor surface findings do not lower base', () => {
    const a = cleanAssessment();
    a.surface.score = 9;
    a.surface.findings.push({ face: 'back', type: 'print_line', severity: 'minor', note: '' });
    const e = estimateGrade(baseInput({ assessment: a, surface: 9 }));
    expect(e.base).toBe(10);
    expect(e.confidence).not.toBe('high');
  });

  it('a front finding at the same severity DOES lower base', () => {
    const a = cleanAssessment();
    a.surface.score = 9;
    a.surface.findings.push({ face: 'front', type: 'scratch', severity: 'minor', note: '' });
    const e = estimateGrade(baseInput({ assessment: a, surface: 9 }));
    expect(e.base).toBe(9);
  });

  it('missing raking shots produce a ceiling, never a grade', () => {
    const e = estimateGrade(baseInput({ surface: null }));
    expect(e.isCeiling).toBe(true);
    expect(e.recommendation).toBe('inconclusive');
    expect(e.band.p10).toBe(0);
    expect(e.notes.join(' ')).toMatch(/ceiling/i);
  });

  it('abstention yields inconclusive with the reason surfaced', () => {
    const a = cleanAssessment();
    a.abstain = true;
    a.abstainReason = 'Corner shots too blurry to judge.';
    const e = estimateGrade(baseInput({ assessment: a }));
    expect(e.recommendation).toBe('inconclusive');
    expect(e.notes[0]).toMatch(/blurry/);
  });

  it('borderline flags step P(10) down', () => {
    const p0 = bandFor(10, 0, 'ultra_modern').p10;
    const p1 = bandFor(10, 1, 'ultra_modern').p10;
    const p2 = bandFor(10, 2, 'ultra_modern').p10;
    expect(p0).toBeGreaterThan(p1);
    expect(p1).toBeGreaterThan(p2);
    const a = cleanAssessment();
    a.corners.borderline = true;
    a.surface.borderline = true;
    expect(countBorderlineFlags(a)).toBe(2);
  });

  it('design-element centering drops confidence below high', () => {
    const e = estimateGrade(baseInput({ centeringMethod: 'design_element' }));
    expect(e.confidence).not.toBe('high');
    expect(e.notes.join(' ')).toMatch(/proxy/i);
  });

  it('vintage bands weight the lower grades in', () => {
    expect(bandFor(10, 0, 'vintage').pLow).toBeGreaterThan(bandFor(10, 0, 'ultra_modern').pLow);
  });

  it('a base-9 vintage card is marginal, not submit — its own band says 50% ≤8', () => {
    const e = estimateGrade(baseInput({ centering: 9, era: 'vintage' }));
    expect(e.base).toBe(9);
    expect(e.recommendation).toBe('marginal');
  });
});

// ---------------------------------------------------------------------------
// EV: hand-worked examples
// ---------------------------------------------------------------------------

describe('computeEv', () => {
  const band = { p10: 0.6, p9: 0.33, p8: 0.06, pLow: 0.01 };
  const input = {
    value10: 1000,
    value9: 300,
    valueLow: 100,
    rawValue: 250,
    costBasis: 200,
    gradingFee: 25,
    shippingPerCard: 5,
    suppliesPerCard: 2,
    saleFeeRate: 0.1,
  };

  it('matches the hand-worked example', () => {
    const r = computeEv(band, input);
    expect(r.evGross).toBeCloseTo(706, 5); // 600 + 99 + 7
    expect(r.evNet).toBeCloseTo(706 * 0.9 - 32, 5);
    expect(r.rawNet).toBeCloseTo(225, 5);
    expect(r.uplift).toBeCloseTo(603.4 - 225, 5);
    expect(r.profit).toBeCloseTo(603.4 - 200, 5);
    expect(r.verdict).toBe('worth_submitting');
  });

  it('solves break-even P(10) directly', () => {
    const r = computeEv(band, input);
    // blended non-10 value = (0.33·300 + 0.07·100) / 0.4 = 265
    // target gross = (225 + 32) / 0.9 = 285.556 → p* = 20.556 / 735
    expect(r.breakEvenP10).toBeCloseTo((285.5555555 - 265) / (1000 - 265), 5);
    // Sanity: plugging p* back reproduces raw_net.
    const p = r.breakEvenP10!;
    const blended = 265;
    const gross = p * 1000 + (1 - p) * blended;
    expect(gross * 0.9 - 32).toBeCloseTo(225, 4);
  });

  it('says sell raw when grading cannot beat the raw price', () => {
    const r = computeEv(
      { p10: 0.05, p9: 0.55, p8: 0.3, pLow: 0.1 },
      { ...input, value10: 300, value9: 120, valueLow: 40, rawValue: 250 },
    );
    expect(r.uplift).toBeLessThan(0);
    expect(r.verdict).toBe('sell_raw');
  });

  it('flags a thin edge as marginal', () => {
    // Uplift positive but under 25% of the 32/card grading cost.
    const r = computeEv(
      { p10: 0.5, p9: 0.5, p8: 0, pLow: 0 },
      { ...input, value10: 335, value9: 250, rawValue: 250 },
    );
    expect(r.uplift).toBeGreaterThan(0);
    expect(r.uplift).toBeLessThan(0.25 * 32);
    expect(r.verdict).toBe('marginal');
  });
});
