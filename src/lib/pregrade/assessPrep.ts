// Build the image set for the defect assessment: corner macros
// (downscaled), edge strips cropped server-… no — cropped CLIENT-side
// from the perspective-corrected flat-on shots, and the raking shots.
// Everything is sized to keep the request comfortably under the
// serverless body limit.

import { CANONICAL_H, CANONICAL_W, detectCardQuad } from './centering';
import { blobToRaster, rasterCropToJpeg } from './decode';
import { warpQuad } from './raster';
import type { Shots } from '../../pages/PregradePage';

export interface AssessImage {
  slot: string;
  blob: Blob;
}

async function resizeJpeg(blob: Blob, longEdge: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const long = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, longEdge / long);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!out) throw new Error('encode failed');
    return out;
  } finally {
    bitmap.close();
  }
}

/** Edge-strip thickness on the canonical (500×700) card. */
export const EDGE_STRIP = 56;

/** The four strip rectangles on the canonical card, in reading order. */
export const EDGE_STRIP_RECTS: Array<{
  loc: 'top' | 'bottom' | 'left' | 'right';
  x: number;
  y: number;
  w: number;
  h: number;
}> = [
  { loc: 'top', x: 0, y: 0, w: CANONICAL_W, h: EDGE_STRIP },
  { loc: 'bottom', x: 0, y: CANONICAL_H - EDGE_STRIP, w: CANONICAL_W, h: EDGE_STRIP },
  { loc: 'left', x: 0, y: 0, w: EDGE_STRIP, h: CANONICAL_H },
  { loc: 'right', x: CANONICAL_W - EDGE_STRIP, y: 0, w: EDGE_STRIP, h: CANONICAL_H },
];

/**
 * Warp a face shot to the canonical card. Flattened shots ARE the card;
 * otherwise the outline is detected (null when it can't be found).
 * Shared by the assessment payload and the report's edge previews so
 * both show exactly the same pixels.
 */
export async function faceCanonicalCard(blob: Blob, flattened: boolean) {
  const { raster } = await blobToRaster(blob, 1600);
  if (flattened) {
    return warpQuad(
      raster,
      [
        { x: 0, y: 0 },
        { x: raster.width, y: 0 },
        { x: raster.width, y: raster.height },
        { x: 0, y: raster.height },
      ],
      CANONICAL_W,
      CANONICAL_H,
    );
  }
  const quad = detectCardQuad(raster);
  return quad ? warpQuad(raster, quad.quad, CANONICAL_W, CANONICAL_H) : null;
}

async function edgeStrips(
  blob: Blob,
  face: 'front' | 'back',
  flattened: boolean,
): Promise<AssessImage[]> {
  const card = await faceCanonicalCard(blob, flattened);
  if (!card) {
    // No quad: send the whole flat shot instead so edges are still seen.
    return [{ slot: `${face}_flat`, blob: await resizeJpeg(blob, 1200) }];
  }
  const prefix = face === 'front' ? 'edge_front' : 'edge_back';
  const out: AssessImage[] = [];
  for (const r of EDGE_STRIP_RECTS) {
    out.push({ slot: `${prefix}_${r.loc}`, blob: await rasterCropToJpeg(card, r.x, r.y, r.w, r.h) });
  }
  return out;
}

export async function prepareAssessmentImages(
  shots: Shots,
): Promise<{ images: AssessImage[]; hasRake: boolean }> {
  const images: AssessImage[] = [];
  for (const slot of ['corner_tl', 'corner_tr', 'corner_br', 'corner_bl'] as const) {
    const s = shots[slot];
    if (s) images.push({ slot, blob: await resizeJpeg(s.blob, 800) });
  }
  // Raking shots BEFORE the edge strips: if a cap ever trims the tail
  // again, it loses redundant strips — never the only surface evidence.
  const hasRake = Boolean(shots.rake_front || shots.rake_back);
  for (const slot of ['rake_front', 'rake_back'] as const) {
    const s = shots[slot];
    if (s) images.push({ slot, blob: await resizeJpeg(s.blob, 1200) });
  }
  if (shots.front) {
    images.push(...(await edgeStrips(shots.front.blob, 'front', shots.front.flattened ?? false)));
  }
  if (shots.back) {
    images.push(...(await edgeStrips(shots.back.blob, 'back', shots.back.flattened ?? false)));
  }
  return { images, hasRake };
}
