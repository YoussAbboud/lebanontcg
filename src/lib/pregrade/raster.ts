// Minimal raster toolkit for the pre-grade engine. Works on a plain
// pixel buffer so the same code runs in the browser (from a canvas) and
// in Node tests (from the procedural fixture generator) — no DOM here.

export interface Raster {
  width: number;
  height: number;
  /** RGBA, row-major, like ImageData.data. */
  data: Uint8ClampedArray;
}

export function makeRaster(width: number, height: number, fill = 0): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill;
    data[i + 1] = fill;
    data[i + 2] = fill;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

/** Rec. 601 luma, 0–255. */
export function lumaAt(r: Raster, x: number, y: number): number {
  const o = (y * r.width + x) * 4;
  return 0.299 * r.data[o] + 0.587 * r.data[o + 1] + 0.114 * r.data[o + 2];
}

/** Grayscale plane (Float32Array, row-major) — cheaper to rescan. */
export function toLuma(r: Raster): Float32Array {
  const out = new Float32Array(r.width * r.height);
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      out[y * r.width + x] = lumaAt(r, x, y);
    }
  }
  return out;
}

export interface Point {
  x: number;
  y: number;
}

/** 3×3 homography mapping the unit correspondences src[i] → dst[i]. */
export function homographyFromPoints(src: Point[], dst: Point[]): number[] {
  // Direct linear transform: 8 unknowns (h22 = 1), solved by Gaussian
  // elimination with partial pivoting.
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const d = a[col][col];
    if (Math.abs(d) < 1e-12) throw new Error('degenerate homography');
    for (let row = col + 1; row < n; row++) {
      const f = a[row][col] / d;
      for (let k = col; k < n; k++) a[row][k] -= f * a[col][k];
      b[row] -= f * b[col];
    }
  }
  const h = new Array<number>(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * h[k];
    h[row] = sum / a[row][row];
  }
  return [...h, 1];
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/**
 * Warp the quad (tl, tr, br, bl) of `src` into an axis-aligned outW×outH
 * raster via inverse mapping + bilinear sampling.
 */
export function warpQuad(src: Raster, quad: Point[], outW: number, outH: number): Raster {
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  // dst → src so each output pixel pulls from the photo.
  const h = homographyFromPoints(dstCorners, quad);
  const out = makeRaster(outW, outH);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const p = applyHomography(h, { x: x + 0.5, y: y + 0.5 });
      const sx = Math.min(Math.max(p.x, 0), src.width - 1.001);
      const sy = Math.min(Math.max(p.y, 0), src.height - 1.001);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 3; c++) {
        const p00 = src.data[(y0 * src.width + x0) * 4 + c];
        const p10 = src.data[(y0 * src.width + x0 + 1) * 4 + c];
        const p01 = src.data[((y0 + 1) * src.width + x0) * 4 + c];
        const p11 = src.data[((y0 + 1) * src.width + x0 + 1) * 4 + c];
        out.data[o + c] =
          p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Mean of a luma window; clamped to the plane. */
export function windowMean(
  luma: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let sum = 0;
  let n = 0;
  const ax0 = Math.max(0, Math.min(x0, x1));
  const ax1 = Math.min(width - 1, Math.max(x0, x1));
  const ay0 = Math.max(0, Math.min(y0, y1));
  const ay1 = Math.min(height - 1, Math.max(y0, y1));
  for (let y = ay0; y <= ay1; y++) {
    for (let x = ax0; x <= ax1; x++) {
      sum += luma[y * width + x];
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
