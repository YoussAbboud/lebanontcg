// Versioned centering thresholds. PSA tightened the published front
// tolerance from 60/40 to 55/45 during 2025 and it will move again, so
// the thresholds live in a config object with a version stamp — every
// stored report records which version scored it, and the UI notes when
// a report was scored under a superseded standard.

export interface CenteringStandard {
  version: string;
  effectiveFrom: string; // ISO date
  /** [maxLargerSidePercent, subScore] rows, tightest first. */
  front: Array<[number, number]>;
  back: Array<[number, number]>;
  /** Fallback score when worse than every row. */
  frontFloor: number;
  backFloor: number;
}

export const CENTERING_STANDARDS: CenteringStandard[] = [
  {
    version: 'psa-2025-05',
    effectiveFrom: '2025-05-01',
    front: [
      [55, 10],
      [60, 9],
      [65, 8],
      [70, 7],
      [75, 6],
      [80, 5],
      [90, 4],
    ],
    frontFloor: 3,
    back: [
      [75, 10],
      [90, 9],
    ],
    backFloor: 8,
  },
];

export const CURRENT_STANDARD = CENTERING_STANDARDS[CENTERING_STANDARDS.length - 1];

export function standardByVersion(version: string): CenteringStandard | null {
  return CENTERING_STANDARDS.find((s) => s.version === version) ?? null;
}

export function isSuperseded(version: string): boolean {
  return version !== CURRENT_STANDARD.version && standardByVersion(version) !== null;
}

/** Map a front ratio's larger side (e.g. 62.5) to a centering sub-score. */
export function frontCenteringScore(largerSide: number, std = CURRENT_STANDARD): number {
  for (const [max, score] of std.front) {
    if (largerSide <= max + 1e-9) return score;
  }
  return std.frontFloor;
}

export function backCenteringScore(largerSide: number, std = CURRENT_STANDARD): number {
  for (const [max, score] of std.back) {
    if (largerSide <= max + 1e-9) return score;
  }
  return std.backFloor;
}
