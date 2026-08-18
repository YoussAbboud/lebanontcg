#!/usr/bin/env node
// Calibration: turn reported outcomes into measured per-bucket hit
// rates. NEVER auto-applies — it writes calibration.next.json and a
// confusion matrix for a human to review, diff and commit.
//
// Usage:
//   node scripts/calibrate.mjs outcomes.json
//
// outcomes.json: an array of rows exported from pregrade_reports joined
// with pregrade_outcomes:
//   [{ "base": 10, "flags": 0, "era": "ultra_modern", "actual": 9 }, ...]
//
// Export query (Supabase SQL editor):
//   select r.base_grade as base,
//          0 as flags,   -- or your stored flag count
//          r.era, o.actual_grade as actual
//   from pregrade_reports r join pregrade_outcomes o on o.report_id = r.id;

import { readFileSync, writeFileSync } from 'node:fs';

const MIN_BUCKET = 10; // buckets with fewer outcomes keep their prior

const inPath = process.argv[2];
if (!inPath) {
  console.error('usage: node scripts/calibrate.mjs outcomes.json');
  process.exit(1);
}
const rows = JSON.parse(readFileSync(inPath, 'utf8'));
const prior = JSON.parse(readFileSync(new URL('../src/lib/pregrade/calibration.json', import.meta.url), 'utf8'));

const key = (r) => `${Math.min(10, Math.max(7, r.base))}|${Math.min(2, Math.max(0, r.flags ?? 0))}|${r.era}`;
const byBucket = new Map();
for (const r of rows) {
  if (!byBucket.has(key(r))) byBucket.set(key(r), []);
  byBucket.get(key(r)).push(r.actual);
}

const buckets = { ...prior.buckets };
const counts = {};
let measured = 0;
for (const [k, actuals] of byBucket) {
  counts[k] = actuals.length;
  if (actuals.length < MIN_BUCKET) continue;
  const n = actuals.length;
  buckets[k] = {
    p10: +(actuals.filter((a) => a >= 10).length / n).toFixed(3),
    p9: +(actuals.filter((a) => a === 9).length / n).toFixed(3),
    p8: +(actuals.filter((a) => a === 8).length / n).toFixed(3),
    pLow: +(actuals.filter((a) => a <= 7).length / n).toFixed(3),
  };
  measured++;
}

// Confusion matrix: predicted base band vs actual band.
const band = (g) => (g >= 10 ? '10' : g === 9 ? '9' : g === 8 ? '8' : '≤7');
const bands = ['10', '9', '8', '≤7'];
const matrix = Object.fromEntries(bands.map((p) => [p, Object.fromEntries(bands.map((a) => [a, 0]))]));
for (const r of rows) matrix[band(r.base)][band(r.actual)]++;

console.log(`outcomes: ${rows.length} rows across ${byBucket.size} buckets`);
console.log(`buckets measured (≥${MIN_BUCKET} outcomes): ${measured}; the rest keep their prior`);
console.log('confusion (predicted base band → actual):');
for (const p of bands) console.log(`  ${p.padStart(3)} → ${bands.map((a) => `${a}:${matrix[p][a]}`).join('  ')}`);

const out = {
  _comment: prior._comment,
  version: `measured-${new Date().toISOString().slice(0, 10)}`,
  measured: measured > 0,
  counts,
  buckets,
};
const outPath = new URL('../src/lib/pregrade/calibration.next.json', import.meta.url).pathname;
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`\nwrote ${outPath}`);
console.log('Review it, then REPLACE src/lib/pregrade/calibration.json by hand and commit.');
console.log('This script never applies changes itself.');
