import { useEffect, useRef, useState } from 'react';
import {
  clearInstallPrompt,
  detectIosBrowser,
  detectPlatform,
  dismissInstallForever,
  getInstallPrompt,
  isMobileDevice,
  isSamsungBrowser,
  isStandalone,
  onInstallPrompt,
  readSnooze,
  shouldOfferInstall,
  snoozeInstall,
  type InstallPromptEvent,
} from '../lib/install';
import './addtohome.css';

/** A beat after the page settles, so the sheet doesn't race the content. */
const SHOW_AFTER_MS = 2500;

/**
 * The "add LebanonTCG to your home screen" sheet. Slides up from the bottom
 * on phones (never on desktop, never once the site is already installed),
 * shows the exact taps for this phone's browser — with the icons they'll
 * be looking for — and on Android browsers that allow it, installs in one
 * tap. "Not now" brings it back in two weeks; "Don't show again" doesn't.
 */
export function AddToHomePrompt() {
  const [open, setOpen] = useState(false);
  const [native, setNative] = useState<InstallPromptEvent | null>(() => getInstallPrompt());
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const platform = detectPlatform(ua, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints);

  useEffect(() => {
    const offer = shouldOfferInstall({
      platform,
      standalone: isStandalone(),
      mobile: isMobileDevice(),
      snooze: readSnooze(),
    });
    if (!offer) return;
    const timer = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    const off = onInstallPrompt(setNative);
    const installed = () => {
      // Whatever path they took, it's on the home screen now.
      dismissInstallForever();
      setOpen(false);
    };
    window.addEventListener('appinstalled', installed);
    return () => {
      window.clearTimeout(timer);
      off();
      window.removeEventListener('appinstalled', installed);
    };
  }, [platform]);

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') later();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const later = () => {
    snoozeInstall();
    setOpen(false);
  };
  const never = () => {
    dismissInstallForever();
    setOpen(false);
  };
  const install = async () => {
    if (!native) return;
    setBusy(true);
    try {
      await native.prompt();
      const { outcome } = await native.userChoice;
      if (outcome === 'accepted') dismissInstallForever();
      else snoozeInstall();
    } catch {
      snoozeInstall();
    } finally {
      clearInstallPrompt();
      setNative(null);
      setBusy(false);
      setOpen(false);
    }
  };

  const iosBrowser = detectIosBrowser(ua);
  const samsung = isSamsungBrowser(ua);

  return (
    <>
      <div className="a2hs-backdrop" onClick={later} aria-hidden="true" />
      <div
        className="a2hs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="a2hs-title"
        tabIndex={-1}
        ref={sheetRef}
      >
        <div className="a2hs-grab" aria-hidden="true" />
        <button type="button" className="a2hs-close" aria-label="Not now" onClick={later}>
          ×
        </button>

        <div className="a2hs-head">
          {/* What they'll get: the icon as it sits on a home screen. */}
          <div className="a2hs-tile-wrap" aria-hidden="true">
            <div className="a2hs-tile">
              <img src="/icon-192.png" alt="" width={64} height={64} />
            </div>
            <div className="a2hs-tile-label">LebanonTCG</div>
          </div>
          <div>
            <h2 className="a2hs-title display" id="a2hs-title">
              Add LebanonTCG to your Home Screen
            </h2>
            <p className="a2hs-sub">
              Opens full screen like an app, one tap from your home screen. No app store, nothing
              to download.
            </p>
          </div>
        </div>

        {platform === 'android' && native ? (
          <div className="a2hs-native">
            <button
              type="button"
              className="btn-acid a2hs-install"
              disabled={busy}
              onClick={() => void install()}
            >
              <InstallIcon /> {busy ? 'Adding…' : 'Add to Home Screen'}
            </button>
          </div>
        ) : platform === 'ios' ? (
          <ol className="a2hs-steps">
            <Step n={1} icon={<ShareIcon />}>
              Tap the <b>Share</b> button{' '}
              {iosBrowser === 'safari' ? 'at the bottom of the screen' : 'next to the address bar'}.
            </Step>
            <Step n={2} icon={<PlusSquareIcon />}>
              Scroll down and tap <b>Add to Home Screen</b>.
            </Step>
            <Step n={3} icon={<CheckIcon />}>
              Tap <b>Add</b> in the top corner.
            </Step>
          </ol>
        ) : samsung ? (
          <ol className="a2hs-steps">
            <Step n={1} icon={<LinesIcon />}>
              Tap the <b>menu</b> button at the bottom of the screen.
            </Step>
            <Step n={2} icon={<PlusSquareIcon />}>
              Tap <b>Add page to</b>, then <b>Home screen</b>.
            </Step>
            <Step n={3} icon={<CheckIcon />}>
              Tap <b>Add</b>.
            </Step>
          </ol>
        ) : (
          <ol className="a2hs-steps">
            <Step n={1} icon={<DotsIcon />}>
              Tap the <b>menu</b> button in the top corner.
            </Step>
            <Step n={2} icon={<PlusSquareIcon />}>
              Tap <b>Add to Home screen</b> (or <b>Install app</b>).
            </Step>
            <Step n={3} icon={<CheckIcon />}>
              Tap <b>Add</b> or <b>Install</b>.
            </Step>
          </ol>
        )}

        <div className="a2hs-actions">
          <button type="button" className="btn-outline a2hs-later" onClick={later}>
            Not now
          </button>
          <button type="button" className="a2hs-never" onClick={never}>
            Don&apos;t show again
          </button>
        </div>
      </div>
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="a2hs-step">
      <span className="a2hs-step-n mono-label" aria-hidden="true">
        {n}
      </span>
      <span className="a2hs-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="a2hs-step-text">{children}</span>
    </li>
  );
}

// The icons people will be looking for, drawn the way their phone draws them.
const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** iOS Share: a box with an arrow leaving through the top. */
function ShareIcon() {
  return (
    <svg {...svg}>
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

/** "Add to Home Screen": a rounded square with a plus. */
function PlusSquareIcon() {
  return (
    <svg {...svg}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

/** Chrome's ⋮ menu. */
function DotsIcon() {
  return (
    <svg {...svg} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/** Samsung Internet's ≡ menu. */
function LinesIcon() {
  return (
    <svg {...svg}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...svg}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

/** Install: an arrow dropping into a tray. */
function InstallIcon() {
  return (
    <svg {...svg} width={20} height={20}>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
