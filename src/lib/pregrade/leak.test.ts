// Separation guarantee: NOTHING in the pre-grade code paths may touch
// the real-slab listing columns. If this test fails, an estimate has a
// road into the listings grade fields — close it. (The DB enforces the
// same boundary with the no_pregrade_in_grade_fields constraint.)

import { describe, expect, it } from 'vitest';

const FORBIDDEN = [/grade_company/, /grade_value/, /gradeCompany/, /gradeValue/];

// Every pre-grade module: this library, the UI components, the
// serverless endpoint. Raw source, comments included.
const sources = import.meta.glob(
  ['./**/*.ts', '../../components/pregrade/**/*.tsx', '../../../api/pregrade/**/*.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('pre-grade never touches real slab fields', () => {
  it('scans a non-trivial module tree', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    expect(Object.keys(sources).some((p) => p.includes('api/pregrade'))).toBe(true);
    expect(Object.keys(sources).some((p) => p.includes('components/pregrade'))).toBe(true);
  });

  it('finds no reference to listings grade columns', () => {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      if (path.endsWith('leak.test.ts')) continue;
      for (const rx of FORBIDDEN) {
        if (rx.test(src)) hits.push(`${path}: ${rx}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
