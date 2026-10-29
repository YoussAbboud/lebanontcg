import { useState } from 'react';
import { useToast } from '../state/ToastContext';

interface Props {
  /** The absolute link to share. */
  url: string;
  title: string;
  /** A line to go with the link where the share target shows one. */
  text?: string;
  /** Screen-reader name of the button, e.g. "Share @handle's profile". */
  label: string;
  className?: string;
}

/**
 * An icon-only share button. On phones it opens the system share sheet
 * (WhatsApp, Messages, Instagram…); where there is none it copies the link
 * and says so. The icon is the box-with-arrow phones use for sharing.
 */
export function ShareButton({ url, title, text, label, className }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (typeof nav.share === 'function') {
        try {
          await nav.share({ title, text, url });
          return;
        } catch (err) {
          // Closing the sheet rejects with AbortError: not an error to report.
          if (err instanceof DOMException && err.name === 'AbortError') return;
          // Anything else (a share target refusing): fall through to copying.
        }
      }
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast("Couldn't share the link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn-icon ${className ?? ''}`}
      aria-label={label}
      title="Share"
      disabled={busy}
      onClick={() => void share()}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 15V3" />
        <path d="M8 7l4-4 4 4" />
        <path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      </svg>
    </button>
  );
}
