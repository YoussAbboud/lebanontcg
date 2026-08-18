// Canned assessments for VITE_MOCK=1 — the whole flow runs with no API
// key. Cases cover the interesting shapes: clean gem, indent (the
// hard-cap), edge bleed, dimples-only (never caps), borderline corner,
// and an abstention. `?case=<name>` on /pregrade forces one.

import type { DefectAssessment } from './types';

export type MockCase =
  | 'clean'
  | 'indent'
  | 'edge_bleed'
  | 'dimples'
  | 'borderline'
  | 'scratches'
  | 'abstain';

const base = (): DefectAssessment => ({
  corners: { score: 10, confidence: 'high', borderline: false, findings: [] },
  edges: { score: 10, confidence: 'high', borderline: false, findings: [] },
  surface: { score: 10, confidence: 'moderate', borderline: false, findings: [] },
  authenticityFlags: [],
  imageQualityNotes: [],
  abstain: false,
  abstainReason: null,
});

export const MOCK_ASSESSMENTS: Record<MockCase, () => DefectAssessment> = {
  clean: base,

  indent: () => {
    const a = base();
    a.surface.score = 8;
    a.surface.confidence = 'high';
    a.surface.findings.push({
      face: 'back',
      type: 'indent',
      severity: 'moderate',
      note: 'Irregular depression with texture near the lower-left back, distinct from a flat mark.',
    });
    return a;
  },

  edge_bleed: () => {
    const a = base();
    a.edges.score = 8;
    a.edges.findings.push({
      location: 'right',
      type: 'bleed_into_surface',
      severity: 'moderate',
      note: 'Chipping on the right edge leaves white inside the printed area.',
    });
    return a;
  },

  dimples: () => {
    const a = base();
    a.surface.findings.push(
      {
        face: 'front',
        type: 'dimple',
        severity: 'minor',
        note: 'Small circular factory dimple near the name plate.',
      },
      {
        face: 'back',
        type: 'dimple',
        severity: 'minor',
        note: 'Two shallow circular dimples, consistent with ultra-modern stock.',
      },
    );
    return a;
  },

  borderline: () => {
    const a = base();
    a.corners.borderline = true;
    a.corners.findings.push({
      location: 'bottom_right',
      type: 'soft',
      severity: 'trace',
      note: 'Slight softness under magnification; no whitening beyond a pinpoint.',
    });
    return a;
  },

  scratches: () => {
    const a = base();
    a.surface.score = 9;
    a.surface.findings.push(
      { face: 'front', type: 'scratch', severity: 'minor', note: 'Light scratch, directional light only.' },
      { face: 'front', type: 'scratch', severity: 'minor', note: 'Second light scratch, parallel.' },
      { face: 'front', type: 'scratch', severity: 'minor', note: 'Cluster of fine scratches lower third.' },
    );
    return a;
  },

  abstain: () => ({
    corners: { score: null, confidence: 'not_assessed', borderline: false, findings: [] },
    edges: { score: null, confidence: 'not_assessed', borderline: false, findings: [] },
    surface: { score: null, confidence: 'not_assessed', borderline: false, findings: [] },
    authenticityFlags: [],
    imageQualityNotes: ['Corner shots too soft to judge whitening reliably.'],
    abstain: true,
    abstainReason: 'The corner macros are too soft to judge. Reshoot closer, with focus locked.',
  }),
};

export function mockCaseFrom(value: string | null | undefined): MockCase {
  const cases = Object.keys(MOCK_ASSESSMENTS) as MockCase[];
  return cases.includes(value as MockCase) ? (value as MockCase) : 'clean';
}
