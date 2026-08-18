// The eval fixture set: synthetic capture specs with KNOWN outcomes.
// Each case runs the real centering engine over a generated card, pairs
// it with a canned assessment, and carries the grade the card "actually"
// came back as. The actual grades here are hand-assigned to a plausible
// distribution — they exercise the harness and pin the pipeline's
// behaviour; real reported outcomes replace their role over time.

import type { MockCase } from './mockAssessments';
import type { Era } from './types';

export interface EvalCase {
  name: string;
  lr: number;
  tb: number;
  assess: MockCase;
  era: Era;
  hasRake: boolean;
  /** The grade this card "came back as". */
  actual: number;
  seed: number;
}

export const EVAL_SET: EvalCase[] = [
  // Clean gems: most 10, some 9 — the 60/40 reality of clean submissions.
  { name: 'gem-1', lr: 52, tb: 51, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 10, seed: 501 },
  { name: 'gem-2', lr: 54, tb: 53, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 10, seed: 502 },
  { name: 'gem-3', lr: 53, tb: 52, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 9, seed: 503 },
  { name: 'gem-4', lr: 51, tb: 54, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 10, seed: 504 },
  { name: 'gem-5', lr: 54.5, tb: 51, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 9, seed: 505 },
  { name: 'gem-6', lr: 52, tb: 53, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 10, seed: 506 },
  // Borderline corners: split 10/9.
  { name: 'borderline-1', lr: 53, tb: 52, assess: 'borderline', era: 'ultra_modern', hasRake: true, actual: 9, seed: 511 },
  { name: 'borderline-2', lr: 52, tb: 54, assess: 'borderline', era: 'ultra_modern', hasRake: true, actual: 10, seed: 512 },
  { name: 'borderline-3', lr: 54, tb: 52, assess: 'borderline', era: 'ultra_modern', hasRake: true, actual: 9, seed: 513 },
  // Off-centre 9s and 8s: centering governs.
  { name: 'offcentre-9a', lr: 58, tb: 52, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 9, seed: 521 },
  { name: 'offcentre-9b', lr: 59, tb: 55, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 9, seed: 522 },
  { name: 'offcentre-9c', lr: 57, tb: 58, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 10, seed: 523 },
  { name: 'offcentre-8a', lr: 63, tb: 52, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 8, seed: 524 },
  { name: 'offcentre-8b', lr: 64, tb: 55, assess: 'clean', era: 'ultra_modern', hasRake: true, actual: 8, seed: 525 },
  // Indents: the whole point — they come back 8 (or worse).
  { name: 'indent-1', lr: 52, tb: 52, assess: 'indent', era: 'ultra_modern', hasRake: true, actual: 8, seed: 531 },
  { name: 'indent-2', lr: 54, tb: 51, assess: 'indent', era: 'ultra_modern', hasRake: true, actual: 8, seed: 532 },
  { name: 'indent-3', lr: 53, tb: 53, assess: 'indent', era: 'ultra_modern', hasRake: true, actual: 7, seed: 533 },
  // Edge bleed: 8s and 9s.
  { name: 'bleed-1', lr: 52, tb: 52, assess: 'edge_bleed', era: 'ultra_modern', hasRake: true, actual: 8, seed: 541 },
  { name: 'bleed-2', lr: 55, tb: 53, assess: 'edge_bleed', era: 'ultra_modern', hasRake: true, actual: 8, seed: 542 },
  // Dimples never cap.
  { name: 'dimples-1', lr: 52, tb: 53, assess: 'dimples', era: 'ultra_modern', hasRake: true, actual: 10, seed: 551 },
  { name: 'dimples-2', lr: 54, tb: 52, assess: 'dimples', era: 'ultra_modern', hasRake: true, actual: 9, seed: 552 },
  // Many light scratches: 9s.
  { name: 'scratches-1', lr: 53, tb: 52, assess: 'scratches', era: 'ultra_modern', hasRake: true, actual: 9, seed: 561 },
  // Vintage: wider spread.
  { name: 'vintage-1', lr: 56, tb: 54, assess: 'clean', era: 'vintage', hasRake: true, actual: 8, seed: 571 },
  { name: 'vintage-2', lr: 53, tb: 52, assess: 'clean', era: 'vintage', hasRake: true, actual: 9, seed: 572 },
];
