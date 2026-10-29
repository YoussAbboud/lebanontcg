import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadImages } from './preload';

/** A stand-in for the browser's Image: records each src and lets the test fire load/error. */
function fakeImage() {
  const made: { src: string; onload?: () => void; onerror?: () => void }[] = [];
  class Img {
    onload?: () => void;
    onerror?: () => void;
    private _src = '';
    set src(v: string) {
      this._src = v;
      made.push(this);
    }
    get src() {
      return this._src;
    }
  }
  (globalThis as { Image?: unknown }).Image = Img;
  return made;
}

afterEach(() => {
  delete (globalThis as { Image?: unknown }).Image;
  vi.useRealTimers();
});

describe('preloadImages', () => {
  it('resolves at once with nothing to load, or without a DOM', async () => {
    await expect(preloadImages([])).resolves.toBeUndefined();
    await expect(preloadImages(['/a.jpg'])).resolves.toBeUndefined();
  });

  it('waits for every distinct image to load or fail', async () => {
    const made = fakeImage();
    let settled = false;
    const p = preloadImages(['/a.jpg', '/b.jpg', '/a.jpg', '']).then(() => {
      settled = true;
    });
    expect(made.map((m) => m.src)).toEqual(['/a.jpg', '/b.jpg']);
    made[0].onload?.();
    await Promise.resolve();
    expect(settled).toBe(false);
    made[1].onerror?.();
    await p;
    expect(settled).toBe(true);
  });

  it('gives up after the cap so a stuck image cannot hold the page', async () => {
    vi.useFakeTimers();
    fakeImage();
    let settled = false;
    const p = preloadImages(['/slow.jpg'], 5000).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBe(true);
  });
});
