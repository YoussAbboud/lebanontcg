import { describe, expect, it } from 'vitest';
import { bandLabel, breakEvenSentence, cornerSentence, edgeSentence, surfaceSentence } from './copy';
import type { Estimate } from './types';

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
