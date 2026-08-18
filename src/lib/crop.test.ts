import { describe, expect, it } from 'vitest';
import {
  clampOffset,
  coverScale,
  frameSize,
  moveRect,
  resizeRect,
  sourceRect,
  zoomAt,
} from './crop';

describe('coverScale', () => {
  it('covers a square frame with a landscape image by height', () => {
    expect(coverScale(2000, 1000, 300, 300)).toBeCloseTo(0.3);
  });
  it('covers a square frame with a portrait image by width', () => {
    expect(coverScale(1000, 2000, 300, 300)).toBeCloseTo(0.3);
  });
  it('upscales a small image to cover', () => {
    expect(coverScale(100, 100, 300, 300)).toBeCloseTo(3);
  });
  it('covers a card frame (5:7) with a square image by height', () => {
    expect(coverScale(1000, 1000, 250, 350)).toBeCloseTo(0.35);
  });
});

describe('clampOffset', () => {
  // 2000x1000 at 0.3 in a 300px square: 600x300 css — x slack 150, y slack 0.
  it('allows panning only along the slack axis', () => {
    expect(clampOffset(500, 40, 2000, 1000, 0.3, 300, 300)).toEqual({ x: 150, y: 0 });
    expect(clampOffset(-500, -40, 2000, 1000, 0.3, 300, 300)).toEqual({ x: -150, y: 0 });
  });
  it('keeps in-range offsets untouched', () => {
    expect(clampOffset(75, 0, 2000, 1000, 0.3, 300, 300)).toEqual({ x: 75, y: 0 });
  });
  it('pins a perfectly fitted image to centre', () => {
    expect(clampOffset(10, -10, 1000, 1000, 0.3, 300, 300)).toEqual({ x: 0, y: 0 });
  });
});

describe('sourceRect', () => {
  it('crops the centre when the offset is zero', () => {
    const r = sourceRect(2000, 1000, 0.3, 0, 0, 300, 300);
    expect(r.width).toBeCloseTo(1000);
    expect(r.height).toBeCloseTo(1000);
    expect(r.x).toBeCloseTo(500);
    expect(r.y).toBeCloseTo(0);
  });
  it('a positive x offset (image dragged right) reveals the left side', () => {
    const r = sourceRect(2000, 1000, 0.3, 150, 0, 300, 300);
    expect(r.x).toBeCloseTo(0);
  });
  it('a negative x offset reveals the right side', () => {
    const r = sourceRect(2000, 1000, 0.3, -150, 0, 300, 300);
    expect(r.x).toBeCloseTo(1000);
  });
  it('zooming in shrinks the source rect around the same centre', () => {
    const r = sourceRect(2000, 1000, 0.6, 0, 0, 300, 300);
    expect(r.width).toBeCloseTo(500);
    expect(r.x).toBeCloseTo(750);
  });
  it('never exceeds the image bounds even with a rogue offset', () => {
    const r = sourceRect(2000, 1000, 0.3, 9999, 9999, 300, 300);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

describe('zoomAt', () => {
  it('keeps the frame centre fixed when zooming at the centre', () => {
    expect(zoomAt(1, 2, 0, 0, 0, 0)).toEqual({ x: 0, y: 0 });
  });
  it('pulls the image towards the zoom point', () => {
    // Zoom 2x at the right edge (cx=150): a centred image shifts left.
    expect(zoomAt(1, 2, 0, 0, 150, 0)).toEqual({ x: -150, y: 0 });
  });
  it('is exactly inverted by the reciprocal zoom', () => {
    const once = zoomAt(1, 2, 20, -30, 100, 50);
    const back = zoomAt(2, 1, once.x, once.y, 100, 50);
    expect(back.x).toBeCloseTo(20);
    expect(back.y).toBeCloseTo(-30);
  });
});

describe('moveRect', () => {
  const sel = { x: 100, y: 100, w: 200, h: 200 };
  it('slides freely inside the image', () => {
    expect(moveRect(sel, 50, -30, 800, 800)).toEqual({ x: 150, y: 70, w: 200, h: 200 });
  });
  it('stops at every image edge', () => {
    expect(moveRect(sel, -999, -999, 800, 800)).toEqual({ x: 0, y: 0, w: 200, h: 200 });
    expect(moveRect(sel, 999, 999, 800, 800)).toEqual({ x: 600, y: 600, w: 200, h: 200 });
  });
});

describe('resizeRect', () => {
  const sel = { x: 100, y: 100, w: 200, h: 200 };
  it('drags the east edge without touching the rest', () => {
    expect(resizeRect(sel, 'e', 80, 999, 800, 800, 40)).toEqual({ x: 100, y: 100, w: 280, h: 200 });
  });
  it('drags the north-west corner moving the origin', () => {
    expect(resizeRect(sel, 'nw', -50, -60, 800, 800, 40)).toEqual({ x: 50, y: 40, w: 250, h: 260 });
  });
  it('never shrinks below the minimum size', () => {
    expect(resizeRect(sel, 'se', -999, -999, 800, 800, 40)).toEqual({ x: 100, y: 100, w: 40, h: 40 });
    expect(resizeRect(sel, 'nw', 999, 999, 800, 800, 40)).toEqual({ x: 260, y: 260, w: 40, h: 40 });
  });
  it('never grows past the image bounds', () => {
    expect(resizeRect(sel, 'se', 999, 999, 800, 800, 40)).toEqual({ x: 100, y: 100, w: 700, h: 700 });
    expect(resizeRect(sel, 'nw', -999, -999, 800, 800, 40)).toEqual({ x: 0, y: 0, w: 300, h: 300 });
  });
});

describe('frameSize', () => {
  it('fits a square frame by width', () => {
    expect(frameSize(1, 300, 400)).toEqual({ width: 300, height: 300 });
  });
  it('fits a tall card frame by height', () => {
    expect(frameSize(5 / 7, 340, 350)).toEqual({ width: 250, height: 350 });
  });
});
