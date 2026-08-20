import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import '../../pages/admin.css';

interface Props {
  title: string;
  /** What exactly is about to happen, in plain language. */
  body?: ReactNode;
  confirmLabel: string;
  /** Reason is mandatory (3+ chars) — everything the DB requires one for. */
  requireReason?: boolean;
  reasonLabel?: string;
  placeholder?: string;
  destructive?: boolean;
  onConfirm(reason: string): Promise<void>;
  onClose(): void;
}

/**
 * The single confirmation surface for every admin action. It exists
 * because the audit log is only worth having if each row carries a
 * "why" — so the reason box is part of the action, not an afterthought.
 */
export function ReasonPrompt({
  title,
  body,
  confirmLabel,
  requireReason = false,
  reasonLabel = 'Reason',
  placeholder = 'What did you see, and what are you doing about it?',
  destructive = false,
  onConfirm,
  onClose,
}: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    areaRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const tooShort = requireReason && reason.trim().length < 3;

  const confirm = async () => {
    if (tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action was rejected.');
      setBusy(false);
    }
  };

  // Portalled: .shell-main is a stacking context, so an in-page modal
  // would render beneath the header (same reason as ReportDialog).
  return createPortal(
    <div
      className="rdlg-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="rdlg adlg" role="dialog" aria-modal="true" aria-labelledby="adlg-title">
        <h2 id="adlg-title" className="display rdlg-title">
          {title}
        </h2>
        {body && <div className="rdlg-sub">{body}</div>}

        <label className="rdlg-field">
          <span className="mono-label rdlg-label">
            {reasonLabel}
            {requireReason ? '' : ' (optional)'}
          </span>
          <textarea
            ref={areaRef}
            className="input"
            rows={3}
            maxLength={500}
            placeholder={placeholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        {requireReason && (
          <p className="adlg-hint mono-label">
            Recorded in the audit log against your account.
          </p>
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <div className="rdlg-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={destructive ? 'btn-outline btn-danger-outline' : 'btn-acid'}
            onClick={() => void confirm()}
            disabled={busy || tooShort}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
