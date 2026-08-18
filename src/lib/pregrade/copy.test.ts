import { describe, expect, it } from 'vitest';
import {
  bandLabel,
  breakEvenSentence,
  condenseEdgeFindings,
  cornerSentence,
  displayCornerFinding,
  edgeSentence,
  surfaceSentence,
} from './copy';
import type { EdgeFinding, Estimate } from './types';

const est = (over: Partial<Estimate>): Estimate => ({
  base: 10,
  isCeiling: false,
  band: { p10: 0.6, p9: 0.33, p8: 0.06, pLow: 0.01 },
  borderlineFlags: 0,
  confidence: 'moderate',
  recommendation: 'submit',
  notes: [],
  ...over,
});

describe('bandLabel', () => {
  it('shows a band with confidence, never a bare number', () => {
    expect(bandLabel(est({}))).toBe('Est. PSA 9–10 · Moderate confidence');
  });
  it('collapses to a single grade when one dominates', () => {
    expect(bandLabel(est({ band: { p10: 0.02, p9: 0.9, p8: 0.06, pLow: 0.02 } }))).toBe(
      'Est. PSA 9 · Moderate confidence',
    );
  });
  it('phrases a missing surface as a ceiling', () => {
    expect(bandLabel(est({ isCeiling: true, recommendation: 'inconclusive', base: 10 }))).toBe(
      'Up to PSA 10 · surface not checked',
    );
  });
  it('abstention reads as not enough to go on', () => {
    expect(bandLabel(est({ recommendation: 'inconclusive', isCeiling: false }))).toBe(
      'Not enough to go on',
    );
  });
});

describe('finding sentences use collector language', () => {
  it('corner', () => {
    expect(
      cornerSentence({ location: 'bottom_right', type: 'whitening', severity: 'minor', note: '' }),
    ).toBe('Light whitening on the bottom-right corner');
  });
  it('edge', () => {
    expect(
      edgeSentence({ location: 'right', type: 'bleed_into_surface', severity: 'moderate', note: '' }),
    ).toBe('Noticeable chipping that bleeds into the printed surface along the right edge');
  });
  it('surface', () => {
    expect(surfaceSentence({ face: 'back', type: 'indent', severity: 'moderate', note: '' })).toBe(
      'Noticeable indent on the back',
    );
  });
});

describe('condenseEdgeFindings', () => {
  const edge = (location: EdgeFinding['location'], over: Partial<EdgeFinding> = {}): EdgeFinding => ({
    location,
    type: 'factory_cut',
    severity: 'trace',
    note: 'Clean edge, no visible chipping',
    ...over,
  });

  it('collapses the same benign observation on all four edges into one line', () => {
    const out = condenseEdgeFindings([edge('top'), edge('right'), edge('bottom'), edge('left')]);
    expect(out).toHaveLength(1);
    expect(out[0].sentence).toBe('Trace rough factory cut along all four edges');
    expect(out[0].note).toBe(''); // trace notes are boilerplate — dropped
  });

  it('names the edges when three share a finding', () => {
    const out = condenseEdgeFindings([edge('top'), edge('right'), edge('bottom')]);
    expect(out).toHaveLength(1);
    expect(out[0].sentence).toBe('Trace rough factory cut along the top, right and bottom edges');
  });

  it('keeps distinct findings itemised, with notes above trace severity', () => {
    const out = condenseEdgeFindings([
      edge('top'),
      edge('right', { type: 'chip', severity: 'minor', note: 'Small chip near the corner.' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((f) => f.sentence)).toEqual([
      'Trace rough factory cut along the top edge',
      'Light chipping along the right edge',
    ]);
    expect(out[1].note).toBe('Small chip near the corner.');
  });

  it('a merged group above trace keeps its first note', () => {
    const out = condenseEdgeFindings([
      edge('top', { severity: 'minor', note: 'Whitening visible without magnification.' }),
      edge('right', { severity: 'minor', note: '' }),
      edge('bottom', { severity: 'minor', note: 'Second note.' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].note).toBe('Whitening visible without magnification.');
  });
});

describe('displayCornerFinding', () => {
  it('drops boilerplate notes on trace findings, keeps them above', () => {
    const f = {
      location: 'top_left' as const,
      type: 'soft' as const,
      severity: 'trace' as const,
      note: 'Slight softness under magnification.',
    };
    expect(displayCornerFinding(f).note).toBe('');
    expect(displayCornerFinding({ ...f, severity: 'minor' }).note).toBe(
      'Slight softness under magnification.',
    );
  });
});

describe('breakEvenSentence', () => {
  it('renders plain percentages', () => {
    expect(breakEvenSentence(0.43, 0.6)).toBe(
      'This only pays off if it 10s more than 43% of the time. Your estimate says 60%.',
    );
  });
  it('is empty when break-even is unsolvable', () => {
    expect(breakEvenSentence(null, 0.6)).toBe('');
  });
});
