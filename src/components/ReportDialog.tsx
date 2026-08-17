import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReportReason, ReportTargetType } from '../lib/types';
import { REPORT_REASONS, REPORT_REASON_LABELS } from '../lib/types';
import { useApp } from '../state/AppContext';
import './reportdialog.css';

interface Props {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  onClose(): void;
}

export function ReportDialog({ targetType, targetId, targetLabel, onClose }: Props) {
  const { client, user } = useApp();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus the dialog on open
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    if (!reason) return;
    setState('busy');
    try {
      await client.submitReport({ targetType, targetId, reason, detail: detail.trim() });
      setState('done');
    } catch {
      setState('error');
    }
  };

  // Portalled for the same reason as the photo viewer: .shell-main is a
  // stacking context, so an in-page modal renders beneath the header.
  return createPortal(
    <div className="rdlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="rdlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rdlg-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        {state === 'done' ? (
          <>
            <h2 id="rdlg-title" className="display rdlg-title">Report received</h2>
            <p className="rdlg-sub">
              Thanks for flagging this — our moderators will take a look. Reports are anonymous to
              the other party.
            </p>
            <div className="rdlg-actions">
              <button className="btn-acid" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="rdlg-title" className="display rdlg-title">Report {targetType}</h2>
            <p className="rdlg-sub">You&apos;re reporting <strong>{targetLabel}</strong>.</p>

            {!user && <p className="field-error">Sign in to submit a report.</p>}

            <div className="rdlg-reasons" role="radiogroup" aria-label="Reason">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={reason === r}
                  className="pill"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                >
                  {REPORT_REASON_LABELS[r]}
                </button>
              ))}
            </div>

            <label className="rdlg-field">
              <span className="mono-label rdlg-label">Details (optional)</span>
              <textarea
                className="input"
                rows={3}
                maxLength={1000}
                placeholder="Anything that helps us understand the problem…"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </label>

            {state === 'error' && (
              <p className="field-error" role="alert">Couldn&apos;t submit the report — try again.</p>
            )}

            <div className="rdlg-actions">
              <button className="btn-outline" onClick={onClose}>Cancel</button>
              <button
                className="btn-outline btn-danger-outline"
                disabled={!reason || !user || state === 'busy'}
                onClick={() => void submit()}
              >
                {state === 'busy' ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
