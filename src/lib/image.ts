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

// ---------------------------------------------------------------------------
// Size budget: the last step before anything is uploaded
// ---------------------------------------------------------------------------

export interface ImageBudget {
  /** Never wider/taller than this on the long side. */
  maxLongEdge: number;
  /** Stop shrinking the long edge here, even if the budget isn't met. */
  minLongEdge: number;
  /** Target file size in bytes. */
  maxBytes: number;
}

/** Listing photos: sharp enough to judge a card's condition, small
    enough that eight of them load fast and storage stays cheap. */
export const LISTING_PHOTO_BUDGET: ImageBudget = {
  maxLongEdge: 1600,
  minLongEdge: 1024,
  maxBytes: 350 * 1024,
};

/** Profile photos are shown small (at most a couple of hundred px). */
export const AVATAR_BUDGET: ImageBudget = {
  maxLongEdge: 512,
  minLongEdge: 256,
  maxBytes: 60 * 1024,
};

const QUALITIES = [0.85, 0.78, 0.7, 0.62];

/**
 * The order of attempts: every quality at full size first (sharpness
 * matters more than file size for a card), then the same at 85% of the
 * size, and so on down to minLongEdge.
 */
export function compressionLadder(
  longEdge: number,
  budget: ImageBudget,
): { longEdge: number; quality: number }[] {
  const steps: { longEdge: number; quality: number }[] = [];
  let edge = Math.min(longEdge, budget.maxLongEdge);
  const floor = Math.min(edge, budget.minLongEdge);
  for (;;) {
    for (const quality of QUALITIES) steps.push({ longEdge: Math.round(edge), quality });
    if (edge <= floor) break;
    edge = Math.max(floor, edge * 0.85);
  }
  return steps;
}

/**
 * Re-encode an image as JPEG within a size budget. It also strips the
 * photo's metadata (camera, GPS location), since only pixels are redrawn.
 * A JPEG already inside the budget, size and dimensions alike, is
 * uploaded as it is so it isn't compressed twice. If nothing on the
 * ladder fits, the smallest attempt is used.
 */
export async function compressToBudget(file: Blob, budget: ImageBudget): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const long = Math.max(bitmap.width, bitmap.height);
    if (file.type === 'image/jpeg' && file.size <= budget.maxBytes && long <= budget.maxLongEdge) {
      return file;
    }
    let smallest: Blob | null = null;
    let lastEdge = -1;
    let canvas: HTMLCanvasElement | null = null;
    for (const step of compressionLadder(long, budget)) {
      if (step.longEdge !== lastEdge) {
        const { width, height } = fitWithin(bitmap.width, bitmap.height, step.longEdge);
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D unavailable');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
        lastEdge = step.longEdge;
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
          'image/jpeg',
          step.quality,
        );
      });
      if (blob.size <= budget.maxBytes) return blob;
      if (!smallest || blob.size < smallest.size) smallest = blob;
    }
    return smallest ?? file;
  } finally {
    bitmap.close();
  }
}
