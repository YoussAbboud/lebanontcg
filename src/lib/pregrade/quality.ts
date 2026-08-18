// Capture quality gates. A bad shot is never accepted silently — each
// gate returns a machine reason plus the retake copy shown to the user.
// Pure raster math so the gates unit-test in Node.

import { detectCardQuad, perspectiveDeviation } from './centering';
import { toLuma, type Raster } from './raster';
import type { CaptureSlot } from './types';

export interface QualityThresholds {
  /** Variance-of-Laplacian floor on the analysis-size frame. */
  minBlurVariance: number;
  /** Largest >250-luma blob allowed, as a fraction of the frame (flat shots). */
  maxGlareBlobFrac: number;
  /** Opposite-side length deviation ceiling (keystone). */
  maxPerspectiveDeviation: number;
  /** Card region long edge, in ORIGINAL photo pixels. */
  minCardLongEdge: number;
  /** Raking shots must show real light variation: luma stddev floor. */
  minRakeStddev: number;
}

export const DEFAULT_THRESHOLDS: QualityThresholds = {
  minBlurVariance: 60,
  maxGlareBlobFrac: 0.04,
  maxPerspectiveDeviation: 0.04,
  minCardLongEdge: 1200,
  minRakeStddev: 26,
};

export type QualityFailure =
  | 'blurry'
  | 'glare'
  | 'perspective'
  | 'resolution'
  | 'no_card'
  | 'too_flat';

export const FAILURE_COPY: Record<QualityFailure, string> = {
  blurry: 'Too blurry — hold steady and refocus, then try again.',
  glare: 'A patch of glare is washing out the card. Angle the light away and retake.',
  perspective: "Camera's at an angle. Move directly over the card and try again.",
  resolution: 'Too far away — the card needs to fill more of the frame.',
  no_card: "Couldn't find the card's outline. Plain background, whole card in frame.",
  too_flat: "The light isn't raking. Put a lamp low and to the side until the surface texture shows, then shoot.",
};

export interface QualityResult {
  ok: boolean;
  failure: QualityFailure | null;
  metrics: {
    blurVariance: number;
    glareBlobFrac: number;
    perspectiveDeviation: number | null;
    cardLongEdge: number | null;
    lumaStddev: number;
  };
}

/** Variance of a 4-neighbour Laplacian — the standard sharpness proxy. */
export function blurVariance(img: Raster): number {
  const luma = toLuma(img);
  const { width: w, height: h } = img;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v =
        4 * luma[y * w + x] -
        luma[y * w + x - 1] -
        luma[y * w + x + 1] -
        luma[(y - 1) * w + x] -
        luma[(y + 1) * w + x];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Fraction of the frame covered by the largest contiguous >250-luma blob. */
export function largestGlareBlobFrac(img: Raster): number {
  const luma = toLuma(img);
  const { width: w, height: h } = img;
  const seen = new Uint8Array(w * h);
  let largest = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || luma[i] <= 250) continue;
    let size = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      const neighbours = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];
      for (const q of neighbours) {
        if (q >= 0 && !seen[q] && luma[q] > 250) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  return largest / (w * h);
}

export function lumaStddev(img: Raster): number {
  const luma = toLuma(img);
  let sum = 0;
  for (let i = 0; i < luma.length; i++) sum += luma[i];
  const mean = sum / luma.length;
  let sq = 0;
  for (let i = 0; i < luma.length; i++) sq += (luma[i] - mean) ** 2;
  return Math.sqrt(sq / luma.length);
}

/**
 * Run the gate battery for one slot. `analysis` is the downscaled frame
 * the metrics run on; `originalLongEdge` is the photo's real size and
 * `analysisScale` = analysis px per original px (for the resolution gate).
 */
export function checkCapture(
  slot: CaptureSlot,
  analysis: Raster,
  originalLongEdge: number,
  th: QualityThresholds = DEFAULT_THRESHOLDS,
): QualityResult {
  const isRake = slot === 'rake_front' || slot === 'rake_back';
  const isFlatWhole = slot === 'front' || slot === 'back';
  const metrics: QualityResult['metrics'] = {
    blurVariance: blurVariance(analysis),
    glareBlobFrac: isFlatWhole ? largestGlareBlobFrac(analysis) : 0,
    perspectiveDeviation: null,
    cardLongEdge: null,
    lumaStddev: lumaStddev(analysis),
  };
  const fail = (failure: QualityFailure): QualityResult => ({ ok: false, failure, metrics });

  if (metrics.blurVariance < th.minBlurVariance) return fail('blurry');

  if (isRake) {
    // Glare is EXPECTED here — the failure mode is the opposite: an
    // evenly-lit frame means the light isn't raking.
    if (metrics.lumaStddev < th.minRakeStddev) return fail('too_flat');
    return { ok: true, failure: null, metrics };
  }

  if (isFlatWhole) {
    if (metrics.glareBlobFrac > th.maxGlareBlobFrac) return fail('glare');
    const quad = detectCardQuad(analysis);
    if (!quad) return fail('no_card');
    metrics.perspectiveDeviation = perspectiveDeviation(quad.quad);
    if (metrics.perspectiveDeviation > th.maxPerspectiveDeviation) return fail('perspective');
    const scale = originalLongEdge / Math.max(analysis.width, analysis.height);
    const [tl, tr, , bl] = quad.quad;
    const wPx = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const hPx = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    metrics.cardLongEdge = Math.max(wPx, hPx) * scale;
    if (metrics.cardLongEdge < th.minCardLongEdge) return fail('resolution');
  }

  // Corner macros: sharpness is what matters; framing is on the user.
  return { ok: true, failure: null, metrics };
}
