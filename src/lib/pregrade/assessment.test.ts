import { describe, expect, it } from 'vitest';
import { abstention, parseAssessment } from './assessment';
import { MOCK_ASSESSMENTS } from './mockAssessments';
import { estimateGrade } from './estimate';
import type { DefectAssessment, EstimateInput } from './types';

const validRaw = () => ({
  corners: {
    score: 10,
    confidence: 'high',
    borderline: true,
    findings: [
      { location: 'top_left', type: 'soft', severity: 'trace', note: 'slight softness' },
    ],
  },
  edges: { score: 9, confidence: 'moderate', findings: [] },
  surface: { score: null, confidence: 'not_assessed', findings: [] },
  authenticity_flags: ['suspect_gloss'],
  image_quality_notes: ['back raking shot underexposed'],
  abstain: false,
  abstain_reason: null,
});

describe('parseAssessment', () => {
  it('parses valid snake_case output into the domain shape', () => {
    const a = parseAssessment(validRaw());
    expect(a.corners.score).toBe(10);
    expect(a.corners.borderline).toBe(true);
    expect(a.corners.findings[0].location).toBe('top_left');
    expect(a.surface.score).toBeNull();
    expect(a.surface.confidence).toBe('not_assessed');
    expect(a.authenticityFlags).toEqual(['suspect_gloss']);
    expect(a.imageQualityNotes).toEqual(['back raking shot underexposed']);
    expect(a.abstain).toBe(false);
  });

  it('rejects an unknown finding type with a precise reason', () => {
    const raw = validRaw();
    raw.corners.findings[0].type = 'crease' as never;
    expect(() => parseAssessment(raw)).toThrow(/corner type/);
  });

  it('rejects a bad confidence value', () => {
    const raw = validRaw();
    raw.edges.confidence = 'certain' as never;
    expect(() => parseAssessment(raw)).toThrow(/confidence/);
  });

  it('rejects an assessed attribute with no score', () => {
    const raw = validRaw();
    raw.edges.score = null as never;
    expect(() => parseAssessment(raw)).toThrow(/missing a score/);
  });

  it('clamps out-of-range scores instead of inventing failures', () => {
    const raw = validRaw();
    raw.corners.score = 14 as never;
    expect(parseAssessment(raw).corners.score).toBe(10);
  });

  it('carries the abstain reason through', () => {
    const raw = { ...validRaw(), abstain: true, abstain_reason: 'too blurry' };
    const a = parseAssessment(raw);
    expect(a.abstain).toBe(true);
    expect(a.abstainReason).toBe('too blurry');
  });

  it('abstention helper is fully not_assessed', () => {
    const a = abstention('nope');
    expect(a.abstain).toBe(true);
    expect(a.corners.confidence).toBe('not_assessed');
    expect(a.surface.score).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G3 acceptance at the estimate level, driven by the canned cases the
// mock client serves.
// ---------------------------------------------------------------------------

const est = (assessment: DefectAssessment, over: Partial<EstimateInput> = {}) =>
  estimateGrade({
    centering: 10,
    corners: assessment.corners.score,
    edges: assessment.edges.score,
    surface: assessment.surface.confidence === 'not_assessed' ? null : assessment.surface.score,
    assessment,
    era: 'ultra_modern',
    centeringMethod: 'border_detect',
    allImagesPassedQuality: true,
    ...over,
  });

describe('canned cases through the estimator', () => {
  it('indent case: finding produced, hard 8 cap, do_not_submit', () => {
    const a = MOCK_ASSESSMENTS.indent();
    expect(a.surface.findings.some((f) => f.type === 'indent')).toBe(true);
    const e = est(a);
    expect(e.base).toBe(8);
    expect(e.recommendation).toBe('do_not_submit');
  });

  it('dimples-only case: no cap', () => {
    const e = est(MOCK_ASSESSMENTS.dimples());
    expect(e.base).toBe(10);
    expect(e.recommendation).toBe('submit');
  });

  it('edge-bleed case caps at 8', () => {
    const e = est(MOCK_ASSESSMENTS.edge_bleed());
    expect(e.base).toBe(8);
    expect(e.recommendation).toBe('do_not_submit');
  });

  it('no raking shots: surface not_assessed yields a ceiling, never a grade', () => {
    const a = MOCK_ASSESSMENTS.clean();
    a.surface = { score: null, confidence: 'not_assessed', borderline: false, findings: [] };
    const e = est(a);
    expect(e.isCeiling).toBe(true);
    expect(e.recommendation).toBe('inconclusive');
  });

  it('many light scratches: 9 and do_not_submit', () => {
    const e = est(MOCK_ASSESSMENTS.scratches());
    expect(e.base).toBe(9);
    expect(e.recommendation).toBe('do_not_submit');
  });

  it('abstain case flows through as inconclusive', () => {
    const e = est(MOCK_ASSESSMENTS.abstain());
    expect(e.recommendation).toBe('inconclusive');
    expect(e.notes[0]).toMatch(/reshoot|soft/i);
  });
});
