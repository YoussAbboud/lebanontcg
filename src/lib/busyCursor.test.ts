import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { busyState, endBusy, FRAME_COUNT, FRAME_MS, startBusy, withBusy } from './busyCursor';

// The suite runs in the node environment, so assert on the module's own
// state; the DOM binding (data-busy -> CSS frame) is covered by the
// headless browser pass in TESTING.md.
const attr = () => (busyState().visible ? String(busyState().frame) : null);

describe('busy cursor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Drain any pending work so state doesn't leak between tests.
    while (busyState().pending > 0) endBusy();
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
  });

  it('stays hidden for calls that finish quickly', () => {
    startBusy();
    vi.advanceTimersByTime(100);
    endBusy();
    vi.advanceTimersByTime(500);
    expect(attr()).toBeNull();
    expect(busyState().visible).toBe(false);
  });

  it('appears once a call outlives the grace period', () => {
    startBusy();
    expect(attr()).toBeNull();
    vi.advanceTimersByTime(150);
    expect(attr()).toBe('0');
    expect(busyState().visible).toBe(true);
  });

  it('advances through every frame and wraps', () => {
    startBusy();
    vi.advanceTimersByTime(150);
    const seen = new Set([attr()]);
    for (let i = 0; i < FRAME_COUNT; i++) {
      vi.advanceTimersByTime(FRAME_MS);
      seen.add(attr());
    }
    expect(seen.size).toBe(FRAME_COUNT);
    expect(Number(attr())).toBeLessThan(FRAME_COUNT);
  });

  it('stays up for a minimum time once shown', () => {
    startBusy();
    vi.advanceTimersByTime(150);
    endBusy();
    vi.advanceTimersByTime(100);
    expect(attr()).not.toBeNull(); // still within the minimum
    vi.advanceTimersByTime(250);
    expect(attr()).toBeNull();
  });

  it('reference-counts concurrent calls', () => {
    startBusy();
    startBusy();
    vi.advanceTimersByTime(150);
    endBusy();
    vi.advanceTimersByTime(400);
    expect(attr()).not.toBeNull(); // one call still in flight
    endBusy();
    vi.advanceTimersByTime(400);
    expect(attr()).toBeNull();
  });

  it('does not blink between back-to-back calls', () => {
    startBusy();
    vi.advanceTimersByTime(150);
    endBusy();
    vi.advanceTimersByTime(50);
    startBusy(); // next request arrives before the hide lands
    vi.advanceTimersByTime(400);
    expect(attr()).not.toBeNull();
  });

  it('withBusy brackets a promise and clears after rejection', async () => {
    const failing = withBusy(() => Promise.reject(new Error('nope')));
    vi.advanceTimersByTime(150);
    expect(attr()).toBe('0');
    await expect(failing).rejects.toThrow('nope');
    vi.advanceTimersByTime(500);
    expect(attr()).toBeNull();
  });
});
