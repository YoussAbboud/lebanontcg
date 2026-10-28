import { describe, expect, it } from 'vitest';
import { compressionLadder, fitWithin, MAX_LONG_EDGE } from './image';

describe('fitWithin (compression sizing math)', () => {
  it('leaves small images untouched', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('caps the long edge for landscape images', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it('caps the long edge for portrait images', () => {
    expect(fitWithin(1500, 3000, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it('preserves aspect ratio within rounding', () => {
    const { width, height } = fitWithin(4032, 3024, MAX_LONG_EDGE);
    expect(width).toBe(1600);
    expect(height).toBe(1200);
    expect(Math.abs(width / height - 4032 / 3024)).toBeLessThan(0.01);
  });

  it('rounds to integers', () => {
    const { width, height } = fitWithin(3001, 1000, 1600);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBe(1600);
    expect(height).toBe(533); // 1000 * (1600/3001) = 533.15…
  });

  it('never collapses a dimension to zero', () => {
    expect(fitWithin(10000, 3, 1600).height).toBeGreaterThanOrEqual(1);
    expect(fitWithin(3, 10000, 1600).width).toBeGreaterThanOrEqual(1);
  });
});

describe('compressionLadder (size budget attempts)', () => {
  const budget = { maxLongEdge: 1600, minLongEdge: 1024, maxBytes: 350 * 1024 };

  it('tries every quality at full size before shrinking', () => {
    const steps = compressionLadder(4000, budget);
    expect(steps.slice(0, 4).map((s) => s.longEdge)).toEqual([1600, 1600, 1600, 1600]);
    expect(steps.slice(0, 4).map((s) => s.quality)).toEqual([0.85, 0.78, 0.7, 0.62]);
    expect(steps[4].longEdge).toBe(1360);
  });

  it('never goes below the floor, and ends on it', () => {
    const steps = compressionLadder(4000, budget);
    expect(Math.min(...steps.map((s) => s.longEdge))).toBe(1024);
    expect(steps[steps.length - 1]).toEqual({ longEdge: 1024, quality: 0.62 });
  });

  it('never upscales a small image', () => {
    const steps = compressionLadder(800, budget);
    expect(steps.every((s) => s.longEdge === 800)).toBe(true);
    expect(steps.length).toBe(4);
  });
});
