import { describe, expect, it } from 'vitest';
import { fitWithin, MAX_LONG_EDGE } from './image';

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
