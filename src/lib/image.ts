// Client-side image compression for listing photos: long edge capped at
// 1600px, JPEG q0.85 — keeps uploads fast and storage cheap.

export const MAX_LONG_EDGE = 1600;
export const JPEG_QUALITY = 0.85;

/**
 * Pure sizing math: scale (w, h) to fit within maxLongEdge on the longer
 * side, never upscaling, preserving aspect ratio, rounding to integers
 * (minimum 1px).
 */
export function fitWithin(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxLongEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxLongEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  /** Object URL for previewing — caller owns revocation. */
  url: string;
}

/** Decode, downscale, and re-encode a photo as JPEG. */
export async function compressImage(
  file: Blob,
  maxLongEdge = MAX_LONG_EDGE,
  quality = JPEG_QUALITY,
): Promise<CompressedImage> {
  // 'from-image' applies EXIF orientation during decode so phone photos
  // don't come out sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxLongEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
        'image/jpeg',
        quality,
      );
    });
    return { blob, width, height, url: URL.createObjectURL(blob) };
  } finally {
    bitmap.close();
  }
}
