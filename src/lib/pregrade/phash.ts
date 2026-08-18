// Perceptual hash (aHash, 64-bit) — the publish gate that stops a
// report being attached to a different card's listing. Pure raster math.

import { toLuma, type Raster } from './raster';

/** 8×8 average hash as a 16-char hex string. */
export function aHash(img: Raster): string {
  const luma = toLuma(img);
  const { width: w, height: h } = img;
  const cells = new Float64Array(64);
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const x0 = Math.floor((gx * w) / 8);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / 8));
      const y0 = Math.floor((gy * h) / 8);
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / 8));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += luma[y * w + x];
          n++;
        }
      }
      cells[gy * 8 + gx] = sum / n;
    }
  }
  const mean = cells.reduce((s, v) => s + v, 0) / 64;
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) {
      nibble = (nibble << 1) | (cells[i + b] > mean ? 1 : 0);
    }
    hex += nibble.toString(16);
  }
  return hex;
}

/** Hamming distance between two 16-char hex hashes (0–64). */
export function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i] ?? '0', 16) ^ parseInt(b[i] ?? '0', 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/**
 * Publish gate threshold: at or under this Hamming distance the report's
 * front capture and the listing cover count as the same card.
 */
export const PHASH_MATCH_THRESHOLD = 18;

export const PHASH_MISMATCH_COPY =
  "These photos don't look like the same card as the listing. Attach the report to the right listing, or re-shoot.";
