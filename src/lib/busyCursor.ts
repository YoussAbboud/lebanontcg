// Animated "busy" cursor.
//
// No browser animates an .ani (or an animated GIF) used as a CSS cursor,
// so the frames are separate images and this module steps a `data-busy`
// attribute on <html>; src/styles/cursors.css has one rule per frame.
//
// Every data call goes through here (see lib/client/index.ts), so the
// timings matter: a short grace period keeps fast calls from strobing the
// cursor, and a minimum on-screen time keeps it from flashing once shown.

export const FRAME_COUNT = 12;
export const FRAME_MS = 33; // Busy.ani: 2 jiffies at 60Hz
const SHOW_AFTER_MS = 150;
const MIN_VISIBLE_MS = 300;

let pending = 0;
type Timer = ReturnType<typeof setTimeout>;
let showTimer: Timer | null = null;
let hideTimer: Timer | null = null;
let frameTimer: Timer | null = null;
let shownAt = 0;
let frame = 0;

const root = () => (typeof document === 'undefined' ? null : document.documentElement);

function paint() {
  root()?.setAttribute('data-busy', String(frame));
}

function show() {
  showTimer = null;
  shownAt = Date.now();
  frame = 0;
  paint();
  frameTimer = setInterval(() => {
    frame = (frame + 1) % FRAME_COUNT;
    paint();
  }, FRAME_MS);
}

function hide() {
  hideTimer = null;
  if (frameTimer !== null) {
    clearInterval(frameTimer);
    frameTimer = null;
  }
  root()?.removeAttribute('data-busy');
}

/** Mark one unit of work as in flight. */
export function startBusy(): void {
  pending++;
  if (pending > 1) return;
  if (hideTimer !== null) {
    // Back-to-back requests: keep the spinner up rather than blink.
    clearTimeout(hideTimer);
    hideTimer = null;
    return;
  }
  if (showTimer === null && frameTimer === null) {
    showTimer = setTimeout(show, SHOW_AFTER_MS);
  }
}

/** Mark one unit of work as finished. */
export function endBusy(): void {
  pending = Math.max(0, pending - 1);
  if (pending > 0) return;
  if (showTimer !== null) {
    // Finished before the spinner was ever shown.
    clearTimeout(showTimer);
    showTimer = null;
    return;
  }
  if (frameTimer === null) return;
  const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
  hideTimer = setTimeout(hide, remaining);
}

/** Run a promise-returning call with the busy cursor around it. */
export function withBusy<T>(run: () => Promise<T>): Promise<T> {
  startBusy();
  return run().finally(endBusy);
}

/** Test seam. */
export function busyState() {
  return { pending, visible: frameTimer !== null, frame };
}
