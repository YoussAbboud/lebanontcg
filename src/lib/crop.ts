// Pure geometry for the image cropper: an image of natural size
// (natW, natH) is shown at `scale` (css px per image px), centred on the
// crop frame and shifted by an offset (ox, oy) in css px. The frame must
// always be fully covered by the image.

export interface Offset {
  x: number;
  y: number;
}

export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimum scale at which the image covers the whole frame. */
export function coverScale(natW: number, natH: number, frameW: number, frameH: number): number {
  return Math.max(frameW / natW, frameH / natH);
}

/** Clamp the pan offset so no frame edge ever shows past the image. */
export function clampOffset(
  x: number,
  y: number,
  natW: number,
  natH: number,
  scale: number,
  frameW: number,
  frameH: number,
): Offset {
  const mx = Math.max(0, (natW * scale - frameW) / 2);
  const my = Math.max(0, (natH * scale - frameH) / 2);
  // `+ 0` normalises the -0 that Math.max(-0, …) can produce.
  return {
    x: Math.min(mx, Math.max(-mx, x)) + 0,
    y: Math.min(my, Math.max(-my, y)) + 0,
  };
}

/**
 * The region of the original image (in image pixels) currently visible
 * inside the frame — what the crop will save.
 */
export function sourceRect(
  natW: number,
  natH: number,
  scale: number,
  ox: number,
  oy: number,
  frameW: number,
  frameH: number,
): SourceRect {
  const width = Math.min(natW, frameW / scale);
  const height = Math.min(natH, frameH / scale);
  let x = natW / 2 - ox / scale - width / 2;
  let y = natH / 2 - oy / scale - height / 2;
  x = Math.min(Math.max(0, x), natW - width);
  y = Math.min(Math.max(0, y), natH - height);
  return { x, y, width, height };
}

/**
 * New offset that keeps the frame point (cx, cy) — measured from the
 * frame centre — anchored on the same image point across a zoom from
 * `scale` to `next` (wheel / pinch zoom towards the cursor).
 */
export function zoomAt(
  scale: number,
  next: number,
  ox: number,
  oy: number,
  cx: number,
  cy: number,
): Offset {
  const k = next / scale;
  return { x: cx - (cx - ox) * k, y: cy - (cy - oy) * k };
}

/**
 * Frame css size for an output aspect (w/h), fitted into the available
 * stage box while keeping the exact aspect.
 */
export function frameSize(
  aspect: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return { width: Math.round(width), height: Math.round(height) };
}
