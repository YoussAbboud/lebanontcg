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
const STRIP = 56;

async function edgeStrips(
  blob: Blob,
  face: 'front' | 'back',
  flattened: boolean,
): Promise<AssessImage[]> {
  const { raster } = await blobToRaster(blob, 1600);
  let card;
  if (flattened) {
    // Corner-pinned shot: the frame IS the card — no detection needed.
    card = warpQuad(
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
  } else {
    const quad = detectCardQuad(raster);
    if (!quad) {
      // No quad: send the whole flat shot instead so edges are still seen.
      return [{ slot: `${face}_flat`, blob: await resizeJpeg(blob, 1200) }];
    }
    card = warpQuad(raster, quad.quad, CANONICAL_W, CANONICAL_H);
  }
  const prefix = face === 'front' ? 'edge_front' : 'edge_back';
  return [
    { slot: `${prefix}_top`, blob: await rasterCropToJpeg(card, 0, 0, CANONICAL_W, STRIP) },
    { slot: `${prefix}_bottom`, blob: await rasterCropToJpeg(card, 0, CANONICAL_H - STRIP, CANONICAL_W, STRIP) },
    { slot: `${prefix}_left`, blob: await rasterCropToJpeg(card, 0, 0, STRIP, CANONICAL_H) },
    { slot: `${prefix}_right`, blob: await rasterCropToJpeg(card, CANONICAL_W - STRIP, 0, STRIP, CANONICAL_H) },
  ];
}

export async function prepareAssessmentImages(
  shots: Shots,
): Promise<{ images: AssessImage[]; hasRake: boolean }> {
  const images: AssessImage[] = [];
  for (const slot of ['corner_tl', 'corner_tr', 'corner_br', 'corner_bl'] as const) {
    const s = shots[slot];
    if (s) images.push({ slot, blob: await resizeJpeg(s.blob, 800) });
  }
  if (shots.front) {
    images.push(...(await edgeStrips(shots.front.blob, 'front', shots.front.flattened ?? false)));
  }
  if (shots.back) {
    images.push(...(await edgeStrips(shots.back.blob, 'back', shots.back.flattened ?? false)));
  }
  const hasRake = Boolean(shots.rake_front || shots.rake_back);
  for (const slot of ['rake_front', 'rake_back'] as const) {
    const s = shots[slot];
    if (s) images.push({ slot, blob: await resizeJpeg(s.blob, 1200) });
  }
  return { images, hasRake };
}
