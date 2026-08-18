// Browser-side image decode/encode for the pre-grade flow. This is the
// only pregrade module that touches the DOM — everything downstream
// works on plain Raster buffers.

import type { Raster } from './raster';

export interface DecodedShot {
  /** Downscaled frame for quality gates and centering. */
  raster: Raster;
  /** The photo's true long edge, before downscale. */
  originalLongEdge: number;
}

export async function blobToRaster(blob: Blob, maxLongEdge = 900): Promise<DecodedShot> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const long = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxLongEdge / long);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return {
      raster: { width: w, height: h, data: data.data },
      originalLongEdge: long,
    };
  } finally {
    bitmap.close();
  }
}

/** Store-quality re-encode: 2400px long edge (detail matters here). */
export async function toStorageImage(blob: Blob, longEdge = 2400): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const long = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, longEdge / long);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const webp = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.88),
    );
    if (webp && webp.size > 0) return webp;
    // Safari < 16 fallback.
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!jpeg) throw new Error('encode failed');
    return jpeg;
  } finally {
    bitmap.close();
  }
}

/** Draw a Raster onto a canvas element (previews of warped cards). */
export function drawRasterTo(canvas: HTMLCanvasElement, raster: Raster): void {
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height);
  ctx.putImageData(img, 0, 0);
}

/** JPEG-encode a crop of a raster (edge strips for the assessment call). */
export async function rasterCropToJpeg(
  raster: Raster,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const img = new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height);
  const full = document.createElement('canvas');
  full.width = raster.width;
  full.height = raster.height;
  full.getContext('2d')!.putImageData(img, 0, 0);
  ctx.drawImage(full, x, y, w, h, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('encode failed');
  return blob;
}
