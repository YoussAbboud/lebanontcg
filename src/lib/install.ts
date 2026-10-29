/**
 * "Add to Home Screen": the decision and the plumbing, kept free of React
 * so it can be unit-tested. The sheet itself is components/AddToHomePrompt.
 *
 * The site is a PWA (public/manifest.webmanifest + public/sw.js), so once
 * it sits on a phone's home screen it opens full screen like an app.
 * Android browsers that support it hand us a `beforeinstallprompt` event
 * we can call `prompt()` on; iOS has no such event, so there we show the
 * Share → Add to Home Screen steps instead.
 */

export type InstallPlatform = 'ios' | 'android' | 'other';
export type IosBrowser = 'safari' | 'other';

/** The Chromium `beforeinstallprompt` event (not in lib.dom). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const SNOOZE_KEY = 'ltcg.a2hs';
export const SNOOZE_DAYS = 14;
const DAY_MS = 86_400_000;

/** iPhone/iPad (iPadOS reports itself as a Mac, but a Mac has no touch). */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

/** On iOS every browser is Safari underneath, but only Safari keeps the
    Share button in the bottom toolbar; the others put it in the address bar. */
export function detectIosBrowser(userAgent: string): IosBrowser {
  return /CriOS|FxiOS|EdgiOS|OPT\/|DuckDuckGo/i.test(userAgent) ? 'other' : 'safari';
}

/** Samsung Internet hides "Add page to → Home screen" behind its ≡ menu
    rather than Chrome's ⋮, and never fires beforeinstallprompt. */
export function isSamsungBrowser(userAgent: string): boolean {
  return /SamsungBrowser/i.test(userAgent);
}

export type Snooze = { kind: 'never' } | { kind: 'until'; until: number } | null;

/** What a stored snooze means now: a bad or missing value is no snooze. */
export function parseSnooze(raw: string | null | undefined, now: number): Snooze {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { never?: unknown; until?: unknown };
    if (v.never === true) return { kind: 'never' };
    if (typeof v.until === 'number' && v.until > now) return { kind: 'until', until: v.until };
    return null;
  } catch {
    return null;
  }
}

export interface InstallDecision {
  platform: InstallPlatform;
  /** Already opened from the home screen (display-mode standalone). */
  standalone: boolean;
  /** A phone-sized or touch-first device; desktops don't get the sheet. */
  mobile: boolean;
  snooze: Snooze;
}

/** Whether to slide the sheet up on this visit. */
export function shouldOfferInstall(d: InstallDecision): boolean {
  if (d.platform === 'other') return false;
  if (d.standalone || !d.mobile) return false;
  return d.snooze === null;
}

// ---- browser-facing helpers -------------------------------------------------------------------

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse || window.innerWidth <= 820;
}

export function readSnooze(now = Date.now()): Snooze {
  try {
    return parseSnooze(localStorage.getItem(SNOOZE_KEY), now);
  } catch {
    return null;
  }
}

function write(value: object): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(value));
  } catch {
    // private mode or storage blocked: the sheet just comes back next visit
  }
}

/** "Not now": ask again in two weeks. */
export function snoozeInstall(now = Date.now()): void {
  write({ until: now + SNOOZE_DAYS * DAY_MS });
}

/** "Don't show again", and after a successful install. */
export function dismissInstallForever(): void {
  write({ never: true });
}

// The install event can fire before React mounts, so it's caught at boot
// (main.tsx) and handed to whoever asks for it later.
let captured: InstallPromptEvent | null = null;
const listeners = new Set<(e: InstallPromptEvent) => void>();

export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the browser's own mini-bar out of the way; we show ours
    captured = e as InstallPromptEvent;
    listeners.forEach((l) => l(captured as InstallPromptEvent));
  });
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return captured;
}

export function onInstallPrompt(cb: (e: InstallPromptEvent) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The prompt is single-use: whatever the answer, it's gone afterwards. */
export function clearInstallPrompt(): void {
  captured = null;
}
