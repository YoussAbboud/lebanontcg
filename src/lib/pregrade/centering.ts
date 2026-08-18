// Deterministic centering engine. No model, no network — geometry only,
// identical under VITE_MOCK=1 and in Node unit tests.
//
// Pipeline: card quad detection on the flat-on photo → perspective
// correction to a canonical buffer → inner-border detection by luma
// discontinuity scanning → the standard opposing-border ratios.

import {
  applyHomography as _applyHomography,
  homographyFromPoints as _homographyFromPoints,
  median,
  toLuma,
  warpQuad,
  type Point,
  type Raster,
} from './raster';
import { backCenteringScore, frontCenteringScore, CURRENT_STANDARD } from './standards';
import type { AxisRatio } from './types';

export const CANONICAL_W = 500;
export const CANONICAL_H = 700;

/** Trading card aspect (2.5 × 3.5). */
const CARD_ASPECT = 2.5 / 3.5;
const ASPECT_TOLERANCE = 0.1;

/** Sustained-contrast threshold (0–255 luma) marking a real boundary. */
const EDGE_CONTRAST = 20;
/** Window length used to decide a discontinuity is sustained, not noise. */
const RUN = 6;

// ---------------------------------------------------------------------------
// 1. Card quad detection
// ---------------------------------------------------------------------------

interface Fit {
  /** For vertical-ish sides: x = a·y + b. For horizontal: y = a·x + b. */
  a: number;
  b: number;
}

function fitLine(points: Point[], vertical: boolean): Fit | null {
  if (points.length < 3) return null;
  // Median-based outlier rejection first: logos/hands crossing an edge
  // produce wild hits; drop anything far from the pack.
  const primary = points.map((p) => (vertical ? p.x : p.y));
  const med = median(primary);
  const kept = points.filter((p) => Math.abs((vertical ? p.x : p.y) - med) < med * 0.08 + 8);
  if (kept.length < 3) return null;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (const p of kept) {
    const t = vertical ? p.y : p.x; // independent variable
    const v = vertical ? p.x : p.y; // dependent
    sx += t;
    sy += v;
    sxy += t * v;
    sxx += t * t;
  }
  const n = kept.length;
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  return { a, b };
}

/**
 * Walk along `axis` from the outside in and return the first coordinate
 * where the luma changes by a sustained margin — the background→card
 * boundary.
 */
function firstBoundary(
  luma: Float32Array,
  w: number,
  fixed: number,
  from: number,
  to: number,
  horizontalWalk: boolean,
): number | null {
  const step = from < to ? 1 : -1;
  const at = (t: number) => (horizontalWalk ? luma[fixed * w + t] : luma[t * w + fixed]);
  const contrastAt = (t: number) => {
    let before = 0;
    let after = 0;
    for (let k = 1; k <= RUN; k++) {
      before += at(t - step * k);
      after += at(t + step * k);
    }
    return Math.abs(after - before) / RUN;
  };
  for (let t = from; step > 0 ? t < to - RUN : t > to + RUN; t += step) {
    if (contrastAt(t) > EDGE_CONTRAST) {
      // The windowed test trips as soon as the look-ahead window touches
      // the card — up to RUN px early. Walk on to the contrast PEAK (the
      // true edge), then interpolate the halfway-luma crossing for
      // sub-pixel precision so opposing edges carry no systematic bias.
      let peak = t;
      let peakC = contrastAt(t);
      for (let d = 1; d <= RUN * 2; d++) {
        const c = contrastAt(t + step * d);
        if (c > peakC) {
          peakC = c;
          peak = t + step * d;
        }
      }
      let before = 0;
      let after = 0;
      for (let k = 1; k <= RUN; k++) {
        before += at(peak - step * k) / RUN;
        after += at(peak + step * k) / RUN;
      }
      const midv = (before + after) / 2;
      for (let d = -3; d <= 3; d++) {
        const v0 = at(peak + step * d);
        const v1 = at(peak + step * (d + 1));
        if ((v0 - midv) * (v1 - midv) <= 0 && v0 !== v1) {
          return peak + step * (d + Math.abs((midv - v0) / (v1 - v0)));
        }
      }
      return peak;
    }
  }
  return null;
}

function intersect(v: Fit, hz: Fit): Point {
  // x = v.a·y + v.b ; y = hz.a·x + hz.b
  const y = (hz.a * v.b + hz.b) / (1 - hz.a * v.a);
  const x = v.a * y + v.b;
  return { x, y };
}

export interface QuadResult {
  quad: Point[]; // tl, tr, br, bl
  aspectOk: boolean;
}

/** Find the card's outline in a flat-on photo. Null → manual corners. */
export function detectCardQuad(img: Raster): QuadResult | null {
  const { width: w, height: h } = img;
  const luma = toLuma(img);
  const samples = 24;

  const leftPts: Point[] = [];
  const rightPts: Point[] = [];
  const topPts: Point[] = [];
  const botPts: Point[] = [];
  for (let i = 0; i < samples; i++) {
    const y = Math.round(h * (0.2 + (0.6 * i) / (samples - 1)));
    const lx = firstBoundary(luma, w, y, RUN, Math.floor(w / 2), true);
    if (lx !== null) leftPts.push({ x: lx, y });
    const rx = firstBoundary(luma, w, y, w - 1 - RUN, Math.floor(w / 2), true);
    if (rx !== null) rightPts.push({ x: rx, y });

    const x = Math.round(w * (0.2 + (0.6 * i) / (samples - 1)));
    const ty = firstBoundary(luma, w, x, RUN, Math.floor(h / 2), false);
    if (ty !== null) topPts.push({ x, y: ty });
    const by = firstBoundary(luma, w, x, h - 1 - RUN, Math.floor(h / 2), false);
    if (by !== null) botPts.push({ x, y: by });
  }

  const left = fitLine(leftPts, true);
  const right = fitLine(rightPts, true);
  const top = fitLine(topPts, false);
  const bottom = fitLine(botPts, false);
  if (!left || !right || !top || !bottom) return null;

  const tl = intersect(left, top);
  const tr = intersect(right, top);
  const br = intersect(right, bottom);
  const bl = intersect(left, bottom);
  const quad = [tl, tr, br, bl];
  if (quad.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;

  const widthPx = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
  const heightPx = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;
  if (widthPx < 20 || heightPx < 20) return null;
  const aspect = widthPx / heightPx;
  const aspectOk = Math.abs(aspect - CARD_ASPECT) / CARD_ASPECT <= ASPECT_TOLERANCE;
  return { quad, aspectOk };
}

/** How far the shot is from flat-on: max opposite-side length deviation. */
export function perspectiveDeviation(quad: Point[]): number {
  const [tl, tr, br, bl] = quad;
  const topLen = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const botLen = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftLen = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightLen = Math.hypot(br.x - tr.x, br.y - tr.y);
  const dh = Math.abs(topLen - botLen) / Math.max(topLen, botLen);
  const dv = Math.abs(leftLen - rightLen) / Math.max(leftLen, rightLen);
  return Math.max(dh, dv);
}

/** Perspective-correct the detected card into the canonical buffer. */
export function correctPerspective(img: Raster, quad: Point[]): Raster {
  return warpQuad(img, quad, CANONICAL_W, CANONICAL_H);
}

// ---------------------------------------------------------------------------
// 2. Inner border detection (on the canonical buffer)
// ---------------------------------------------------------------------------

export interface Borders {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Find the border→artwork transition on each side of a corrected card.
 * Samples at 25/50/75% of each edge, takes the per-side median so a logo
 * or text block touching the border on one sample line doesn't skew it.
 * Returns null when no sustained transition exists — borderless cards.
 */
export function detectInnerBorders(card: Raster): Borders | null {
  const { width: w, height: h } = card;
  const luma = toLuma(card);
  // The warp blends a couple of background pixels into the outermost
  // rows, so the border-stock reference window starts past that zone —
  // otherwise a borderless card reads its own blend line as a "border".
  const inset = 6;
  const maxDepthX = Math.floor(w * 0.25);
  const maxDepthY = Math.floor(h * 0.25);

  const scan = (
    fixedPositions: number[],
    horizontalWalk: boolean,
    fromLow: boolean,
    maxDepth: number,
  ): number | null => {
    const hits: number[] = [];
    const limit = horizontalWalk ? w : h;
    for (const fixed of fixedPositions) {
      const start = fromLow ? 0 : limit - 1;
      const dir = fromLow ? 1 : -1;
      // Depth-indexed access: d px in from the card edge on this line.
      const at = (d: number) => {
        const t = start + dir * d;
        return horizontalWalk ? luma[fixed * w + t] : luma[t * w + fixed];
      };
      const contrastAt = (d: number) => {
        let before = 0;
        let after = 0;
        for (let k = 1; k <= RUN; k++) {
          before += at(d - k);
          after += at(d + k);
        }
        return Math.abs(after - before) / RUN;
      };
      let hit: number | null = null;
      for (let d = inset + RUN; d < maxDepth; d++) {
        if (contrastAt(d) > EDGE_CONTRAST) {
          // Advance to the contrast peak (the true transition), then
          // interpolate the halfway-luma crossing for sub-pixel depth —
          // opposing sides must not carry a systematic bias.
          let peak = d;
          let peakC = contrastAt(d);
          for (let e = 1; e <= RUN * 2; e++) {
            const c = contrastAt(d + e);
            if (c > peakC) {
              peakC = c;
              peak = d + e;
            }
          }
          let before = 0;
          let after = 0;
          for (let k = 1; k <= RUN; k++) {
            before += at(peak - k) / RUN;
            after += at(peak + k) / RUN;
          }
          const midv = (before + after) / 2;
          hit = peak;
          for (let e = -3; e <= 3; e++) {
            const v0 = at(peak + e);
            const v1 = at(peak + e + 1);
            if ((v0 - midv) * (v1 - midv) <= 0 && v0 !== v1) {
              hit = peak + e + Math.abs((midv - v0) / (v1 - v0));
              break;
            }
          }
          break;
        }
      }
      if (hit !== null) hits.push(hit);
    }
    return hits.length >= 2 ? median(hits) : null;
  };

  const ys = [0.25, 0.5, 0.75].map((f) => Math.round(h * f));
  const xs = [0.25, 0.5, 0.75].map((f) => Math.round(w * f));
  const left = scan(ys, true, true, maxDepthX);
  const right = scan(ys, true, false, maxDepthX);
  const top = scan(xs, false, true, maxDepthY);
  const bottom = scan(xs, false, false, maxDepthY);
  if (left === null || right === null || top === null || bottom === null) return null;
  return { left, right, top, bottom };
}

// ---------------------------------------------------------------------------
// 3. Ratios and scores
// ---------------------------------------------------------------------------

/** [larger, smaller] as percentages of the axis total, one decimal. */
export function axisRatio(a: number, b: number): AxisRatio {
  const total = a + b;
  if (total <= 0) return [50, 50];
  const first = (Math.max(a, b) / total) * 100;
  const r = (v: number) => Math.round(v * 10) / 10;
  return [r(first), r(100 - first)];
}

export function ratiosFromBorders(b: Borders): { leftRight: AxisRatio; topBottom: AxisRatio } {
  return {
    leftRight: axisRatio(b.left, b.right),
    topBottom: axisRatio(b.top, b.bottom),
  };
}

/** The governing (worse) larger-side percentage of the two axes. */
export function worseAxis(r: { leftRight: AxisRatio; topBottom: AxisRatio }): number {
  return Math.max(r.leftRight[0], r.topBottom[0]);
}

export function scoreFrontCentering(
  r: { leftRight: AxisRatio; topBottom: AxisRatio },
  std = CURRENT_STANDARD,
): number {
  return frontCenteringScore(worseAxis(r), std);
}

export function scoreBackCentering(
  r: { leftRight: AxisRatio; topBottom: AxisRatio },
  std = CURRENT_STANDARD,
): number {
  return backCenteringScore(worseAxis(r), std);
}

// Re-exported so UI code needs a single import site.
export const homographyFromPoints = _homographyFromPoints;
export const applyHomography = _applyHomography;
