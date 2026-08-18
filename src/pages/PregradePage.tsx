import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { blobToRaster } from '../lib/pregrade/decode';
import { checkCapture, FAILURE_COPY, type QualityFailure, type QualityResult } from '../lib/pregrade/quality';
import type { Raster } from '../lib/pregrade/raster';
import {
  CAPTURE_SLOTS,
  PREGRADE_DISCLAIMER,
  REQUIRED_SLOTS,
  type CaptureSlot,
} from '../lib/pregrade/types';
import { PregradeWizard } from '../components/pregrade/PregradeWizard';
import { MyReports } from '../components/pregrade/MyReports';
import './pregrade.css';

interface SlotMeta {
  label: string;
  instruction: string;
  required: boolean;
}

const SLOT_META: Record<CaptureSlot, SlotMeta> = {
  front: {
    label: 'Front · flat on',
    instruction: 'Card flat, camera directly above, fill the frame. No angle.',
    required: true,
  },
  back: { label: 'Back · flat on', instruction: 'Same again for the back.', required: true },
  corner_tl: {
    label: 'Top-left corner',
    instruction: 'Get close on the top-left corner. Sharp focus matters more than lighting.',
    required: true,
  },
  corner_tr: { label: 'Top-right corner', instruction: 'Close and sharp on the top-right corner.', required: true },
  corner_br: { label: 'Bottom-right corner', instruction: 'Close and sharp on the bottom-right corner.', required: true },
  corner_bl: { label: 'Bottom-left corner', instruction: 'Close and sharp on the bottom-left corner.', required: true },
  rake_front: {
    label: 'Front · raking light',
    instruction:
      'Put a desk lamp low and to the side, so light skims across the card. Tilt until you see the surface texture, then shoot.',
    required: false,
  },
  rake_back: {
    label: 'Back · raking light',
    instruction: 'Same low, side-on light on the back.',
    required: false,
  },
};

export interface Shot {
  blob: Blob;
  url: string;
  raster: Raster;
  originalLongEdge: number;
  quality: QualityResult;
}

export type Shots = Partial<Record<CaptureSlot, Shot>>;

/**
 * The Pre-Grade estimator: guided capture → measured centering → defect
 * assessment → estimate band + EV. A decision-support tool — never a
 * grade, and it says so on every surface.
 */
export function PregradePage() {
  const { user, auth } = useApp();
  const [shots, setShots] = useState<Shots>({});
  const [skipped, setSkipped] = useState<Set<CaptureSlot>>(new Set());
  const [failures, setFailures] = useState<Partial<Record<CaptureSlot, QualityFailure>>>({});
  const [busySlot, setBusySlot] = useState<CaptureSlot | null>(null);
  const [phase, setPhase] = useState<'capture' | 'wizard'>('capture');
  const inputRefs = useRef<Partial<Record<CaptureSlot, HTMLInputElement | null>>>({});

  useEffect(() => {
    return () => {
      Object.values(shots).forEach((s) => s && URL.revokeObjectURL(s.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke on unmount only
  }, []);

  if (!auth.loading && !user) {
    return (
      <main className="pregrade">
        <div className="empty-dashed">
          <h3>Pre-Grade</h3>
          <p>Sign in to check a card&apos;s grade potential before you list it.</p>
          <Link to="/signin" className="btn-acid">Sign in</Link>
        </div>
      </main>
    );
  }

  const pick = async (slot: CaptureSlot, file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setBusySlot(slot);
    setFailures((f) => ({ ...f, [slot]: undefined }));
    try {
      const { raster, originalLongEdge } = await blobToRaster(file, 900);
      const quality = checkCapture(slot, raster, originalLongEdge);
      if (!quality.ok) {
        setFailures((f) => ({ ...f, [slot]: quality.failure! }));
        return;
      }
      const url = URL.createObjectURL(file);
      setShots((prev) => {
        const old = prev[slot];
        if (old) URL.revokeObjectURL(old.url);
        return { ...prev, [slot]: { blob: file, url, raster, originalLongEdge, quality } };
      });
      setSkipped((prev) => {
        const next = new Set(prev);
        next.delete(slot);
        return next;
      });
    } catch {
      setFailures((f) => ({ ...f, [slot]: 'no_card' }));
    } finally {
      setBusySlot(null);
    }
  };

  const requiredDone = REQUIRED_SLOTS.every((s) => shots[s]);
  const doneCount = CAPTURE_SLOTS.filter((s) => shots[s]).length;

  if (phase === 'wizard') {
    return <PregradeWizard shots={shots} onBack={() => setPhase('capture')} />;
  }

  return (
    <main className="pregrade">
      <header className="pregrade-head">
        <div className="mono-label pregrade-eyebrow">Pre-Grade · decision support</div>
        <h1 className="display">Is this card worth grading?</h1>
        <p className="pregrade-sub">
          Eight guided photos. You get a measured centering report, a defect read, an estimated
          PSA band with confidence, and the math on whether submitting beats selling raw.
        </p>
        <p className="mono-label pregrade-disclaimer">{PREGRADE_DISCLAIMER}</p>
      </header>

      <div className="pregrade-slots">
        {CAPTURE_SLOTS.map((slot) => {
          const meta = SLOT_META[slot];
          const shot = shots[slot];
          const failure = failures[slot];
          const isSkipped = skipped.has(slot);
          return (
            <section
              key={slot}
              className={`pregrade-slot panel ${shot ? 'is-done' : ''} ${failure ? 'is-failed' : ''}`}
              aria-label={meta.label}
            >
              <div className="pregrade-slot-top">
                <span className="mono-label pregrade-slot-label">
                  {meta.label}
                  {!meta.required && <em> · optional</em>}
                </span>
                {shot && <span className="pregrade-slot-check" aria-label="Accepted">✓</span>}
              </div>
              {shot ? (
                <img className="pregrade-thumb" src={shot.url} alt={`${meta.label} capture`} />
              ) : (
                <button
                  type="button"
                  className="pregrade-drop"
                  disabled={busySlot !== null}
                  onClick={() => inputRefs.current[slot]?.click()}
                >
                  {busySlot === slot ? 'Checking…' : isSkipped ? 'Skipped — tap to shoot anyway' : '+ Shoot / choose photo'}
                </button>
              )}
              <p className="pregrade-instruction">{meta.instruction}</p>
              {failure && (
                <div className="pregrade-fail" role="alert">
                  <p className="field-error">{FAILURE_COPY[failure]}</p>
                  <button
                    type="button"
                    className="btn-outline pregrade-retake"
                    onClick={() => inputRefs.current[slot]?.click()}
                  >
                    Retake
                  </button>
                </div>
              )}
              {shot && (
                <button
                  type="button"
                  className="btn-ghost-mono pregrade-redo"
                  onClick={() => inputRefs.current[slot]?.click()}
                >
                  Retake
                </button>
              )}
              {!meta.required && !shot && !isSkipped && (
                <button
                  type="button"
                  className="btn-ghost-mono pregrade-skip"
                  onClick={() => setSkipped((prev) => new Set(prev).add(slot))}
                >
                  Skip — mark surface not assessed
                </button>
              )}
              <input
                ref={(el) => {
                  inputRefs.current[slot] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  void pick(slot, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </section>
          );
        })}
      </div>

      <footer className="pregrade-foot">
        <span className="mono-label">{doneCount}/8 shots</span>
        {!shots.rake_front && !shots.rake_back && (
          <span className="pregrade-foot-note">
            No raking-light shots yet — the report will cap out at a ceiling, not an estimate.
          </span>
        )}
        <button
          type="button"
          className="btn-acid"
          disabled={!requiredDone}
          onClick={() => setPhase('wizard')}
        >
          Continue to centering →
        </button>
      </footer>

      <MyReports />
    </main>
  );
}
