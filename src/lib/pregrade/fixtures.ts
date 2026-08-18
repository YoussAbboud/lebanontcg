// Procedural card-photo generator: draws a card with borders at KNOWN
// offsets so centering tests assert against ground truth. Deterministic
// (seeded LCG noise), no canvas — runs in Node.

import { applyHomography, homographyFromPoints, makeRaster, type Point, type Raster } from './raster';

export interface FixtureSpec {
  /** Photo size. */
  width?: number;
  height?: number;
  /** Larger-side percentage per axis, e.g. lr: 60 → 60/40 left-heavy. */
  lr: number;
  tb: number;
  /** Total border budget per axis as a fraction of card size. */
  borderFrac?: number;
  /** Dark card on light background instead of the default light-on-dark. */
  inverted?: boolean;
  /** Borderless: artwork runs to the card edge (no inner transition). */
  borderless?: boolean;
  /** Push one pair of corners in by this many px to fake camera keystone. */
  keystonePx?: number;
  /** Noise seed. */
  seed?: number;
}

export interface Fixture {
  image: Raster;
  /** Ground truth, larger side first, in percent. */
  truth: { lr: number; tb: number };
  /** The card quad actually drawn (tl, tr, br, bl). */
  quad: Point[];
}

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function fillQuad(img: Raster, quad: Point[], value: number, noise: () => number, amp: number) {
  // Scanline fill of a convex quad.
  const ys = quad.map((p) => p.y);
  const y0 = Math.max(0, Math.ceil(Math.min(...ys)));
  const y1 = Math.min(img.height - 1, Math.floor(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    const x0 = Math.max(0, Math.ceil(xs[0]));
    const x1 = Math.min(img.width - 1, Math.floor(xs[xs.length - 1]));
    for (let x = x0; x <= x1; x++) {
      const v = value + (noise() - 0.5) * amp;
      const o = (y * img.width + x) * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
    }
  }
}

export function generateCard(spec: FixtureSpec): Fixture {
  const W = spec.width ?? 600;
  const H = spec.height ?? 800;
  const noise = lcg(spec.seed ?? 7);
  const bg = spec.inverted ? 225 : 32;
  const stock = spec.inverted ? 40 : 232;
  const art = spec.inverted ? 150 : 110;

  const img = makeRaster(W, H, bg);
  // Background noise.
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i] + (noise() - 0.5) * 6;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
  }

  // Card geometry: 2.5:3.5 aspect filling ~70% of the photo height.
  const cardH = Math.round(H * 0.72);
  const cardW = Math.round((cardH * 2.5) / 3.5);
  const cx = W / 2;
  const cy = H / 2;
  const k = spec.keystonePx ?? 0;
  // The flat card plane…
  const flat: Point[] = [
    { x: cx - cardW / 2, y: cy - cardH / 2 },
    { x: cx + cardW / 2, y: cy - cardH / 2 },
    { x: cx + cardW / 2, y: cy + cardH / 2 },
    { x: cx - cardW / 2, y: cy + cardH / 2 },
  ];
  // …seen through a keystoned camera: everything on the card — outline
  // AND inner border — goes through the same homography, so the ground
  // truth survives the engine's projective correction exactly.
  const quad: Point[] = [
    { x: flat[0].x + k, y: flat[0].y },
    { x: flat[1].x - k, y: flat[1].y },
    { x: flat[2].x, y: flat[2].y },
    { x: flat[3].x, y: flat[3].y },
  ];
  const K = k !== 0 ? homographyFromPoints(flat, quad) : null;
  const project = (p: Point): Point => (K ? applyHomography(K, p) : p);
  fillQuad(img, quad, stock, noise, 5);

  if (!spec.borderless) {
    // Border budget split by the requested larger-side percentages. The
    // left/top get the larger share so lr=60 means "left border is the
    // fat one" — the ratio itself is side-agnostic.
    const budgetX = (spec.borderFrac ?? 0.12) * cardW;
    const budgetY = (spec.borderFrac ?? 0.12) * cardH;
    const L = (spec.lr / 100) * budgetX;
    const R = budgetX - L;
    const T = (spec.tb / 100) * budgetY;
    const B = budgetY - T;
    const inner: Point[] = [
      project({ x: flat[0].x + L, y: flat[0].y + T }),
      project({ x: flat[1].x - R, y: flat[1].y + T }),
      project({ x: flat[2].x - R, y: flat[2].y - B }),
      project({ x: flat[3].x + L, y: flat[3].y - B }),
    ];
    fillQuad(img, inner, art, noise, 12);
  } else {
    // Full-bleed art: fill the whole card with artwork-ish texture but no
    // sustained border transition anywhere near the edges.
    fillQuad(img, quad, art, noise, 12);
  }

  return { image: img, truth: { lr: spec.lr, tb: spec.tb }, quad };
}
