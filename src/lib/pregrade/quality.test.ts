import { describe, expect, it } from 'vitest';
import { generateCard } from './fixtures';
import { makeRaster, type Raster } from './raster';
import {
  blurVariance,
  checkCapture,
  largestGlareBlobFrac,
  lumaStddev,
  DEFAULT_THRESHOLDS,
} from './quality';

function boxBlur(img: Raster, radius: number): Raster {
  const out = makeRaster(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= img.height || xx < 0 || xx >= img.width) continue;
          sum += img.data[(yy * img.width + xx) * 4];
          n++;
        }
      }
      const o = (y * out.width + x) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = sum / n;
      out.data[o + 3] = 255;
    }
  }
  return out;
}

function paintGlare(img: Raster, cx: number, cy: number, r: number) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const o = (y * img.width + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    }
  }
}

// The generated fixture at 600×800 is our stand-in for the analysis
// frame; originalLongEdge=2400 stands for the real photo.
const ORIG = 2400;

describe('quality gates', () => {
  it('accepts a sharp, flat, evenly lit front shot', () => {
    const fix = generateCard({ lr: 55, tb: 55, seed: 11 });
    const r = checkCapture('front', fix.image, ORIG);
    expect(r.failure).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('rejects a blurred shot', () => {
    const fix = generateCard({ lr: 55, tb: 55, seed: 12 });
    const soft = boxBlur(fix.image, 3);
    expect(blurVariance(soft)).toBeLessThan(blurVariance(fix.image));
    const r = checkCapture('front', soft, ORIG);
    expect(r.failure).toBe('blurry');
  });

  it('rejects a big contiguous glare blob on a flat shot', () => {
    const fix = generateCard({ lr: 55, tb: 55, seed: 13 });
    paintGlare(fix.image, 300, 400, 60); // ~2.3% of 600×800 — over 4%? area = π·60² ≈ 11310 px = 2.4%
    paintGlare(fix.image, 300, 520, 70);
    const frac = largestGlareBlobFrac(fix.image);
    expect(frac).toBeGreaterThan(0.02);
    const r = checkCapture('front', fix.image, ORIG, { ...DEFAULT_THRESHOLDS, maxGlareBlobFrac: 0.02 });
    expect(r.failure).toBe('glare');
  });

  it('rejects an angled shot with the perspective message', () => {
    const fix = generateCard({ lr: 55, tb: 55, keystonePx: 30, seed: 14 });
    const r = checkCapture('front', fix.image, ORIG);
    expect(r.failure).toBe('perspective');
  });

  it('rejects a too-small card region', () => {
    const fix = generateCard({ lr: 55, tb: 55, seed: 15 });
    const r = checkCapture('front', fix.image, 900); // real photo only 900px long
    expect(r.failure).toBe('resolution');
  });

  it('rejects a flat evenly-lit frame in a raking slot (light not raking)', () => {
    const flat = makeRaster(300, 400, 180); // dead-even luma
    const r = checkCapture('rake_front', flat, ORIG, { ...DEFAULT_THRESHOLDS, minBlurVariance: 0 });
    expect(r.failure).toBe('too_flat');
  });

  it('accepts a raking shot with real light variation', () => {
    const img = makeRaster(300, 400, 0);
    // Horizontal light ramp + speckle: plenty of stddev and gradient.
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 300; x++) {
        const o = (y * 300 + x) * 4;
        const v = (x / 300) * 220 + ((x * 7919 + y * 104729) % 23);
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      }
    }
    expect(lumaStddev(img)).toBeGreaterThan(DEFAULT_THRESHOLDS.minRakeStddev);
    const r = checkCapture('rake_front', img, ORIG);
    expect(r.failure).toBeNull();
  });

  it('corner macros only need sharpness', () => {
    const fix = generateCard({ lr: 55, tb: 55, seed: 16 });
    const r = checkCapture('corner_tl', fix.image, 500); // small photo is fine for corners
    expect(r.ok).toBe(true);
  });
});
