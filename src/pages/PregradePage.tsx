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
import { ImageCropper } from '../components/ImageCropper';
import { CornerPinCropper } from '../components/pregrade/CornerPinCropper';
import { SOFT_FAILURES, SOFT_FAILURE_NOTE } from '../lib/pregrade/quality';
import './pregrade.css';
import { looksLikePickedImage } from '../lib/heic';

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
  /** Corner-pinned and perspective-flattened — the frame IS the card. */
  flattened?: boolean;
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
  /** The picked file awaiting its crop step. */
  const [cropTarget, setCropTarget] = useState<{
    slot: CaptureSlot;
    file: File;
    mode: 'pin' | 'rect';
  } | null>(null);
  /** Soft-failed shots held for the user's call: retake or use anyway. */
  const [held, setHeld] = useState<Partial<Record<CaptureSlot, Shot>>>({});
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

  // Every shot goes through the crop step first: cropping tight to the
  // card strips the background clutter that confuses both the outline
  // detector and the vision model.
  const pick = (slot: CaptureSlot, file: File | undefined) => {
    if (!file || !looksLikePickedImage(file)) return;
    setFailures((f) => ({ ...f, [slot]: undefined }));
    // Rake shots keep the plain rectangle crop (glare and texture are
    // the point there, not geometry); everything else pins corners.
    setCropTarget({
      slot,
      file,
      mode: slot === 'rake_front' || slot === 'rake_back' ? 'rect' : 'pin',
    });
  };

  const accept = (slot: CaptureSlot, shot: Shot) => {
    setShots((prev) => {
      const old = prev[slot];
      if (old) URL.revokeObjectURL(old.url);
      return { ...prev, [slot]: shot };
    });
    setHeld((prev) => ({ ...prev, [slot]: undefined }));
    setFailures((f) => ({ ...f, [slot]: undefined }));
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });
  };

  const cropped = async (
    slot: CaptureSlot,
    blob: Blob,
    url: string,
    srcLongEdge: number | undefined,
    flattened: boolean,
  ) => {
    setCropTarget(null);
    setBusySlot(slot);
    try {
      const { raster, originalLongEdge } = await blobToRaster(blob, 900);
      const quality = checkCapture(
        slot,
        raster,
        srcLongEdge ?? originalLongEdge,
        undefined,
        flattened,
      );
      const shot: Shot = { blob, url, raster, originalLongEdge, quality, flattened };
      if (!quality.ok) {
        setFailures((f) => ({ ...f, [slot]: quality.failure! }));
        // Detector-driven failures can be wrong — hold the shot so the
        // user can overrule. Hard failures are discarded.
        if (SOFT_FAILURES.has(quality.failure!)) {
          setHeld((prev) => ({ ...prev, [slot]: shot }));
        } else {
          URL.revokeObjectURL(url);
        }
        return;
      }
      accept(slot, shot);
    } catch {
      setFailures((f) => ({ ...f, [slot]: 'no_card' }));
      URL.revokeObjectURL(url);
    } finally {
      setBusySlot(null);
    }
  };

  const requiredDone = REQUIRED_SLOTS.every((s) => shots[s]);
  const doneCount = CAPTURE_SLOTS.filter((s) => shots[s]).length;
  const allPassedQuality = CAPTURE_SLOTS.every((s) => !shots[s] || shots[s]!.quality.ok);

  if (phase === 'wizard') {
    return (
      <PregradeWizard
        shots={shots}
        allPassedQuality={allPassedQuality}
        onBack={() => setPhase('capture')}
      />
    );
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
                  {held[slot] && <p className="pregrade-soft-note">{SOFT_FAILURE_NOTE}</p>}
                  <div className="pregrade-fail-actions">
                    <button
                      type="button"
                      className="btn-outline pregrade-retake"
                      onClick={() => inputRefs.current[slot]?.click()}
                    >
                      Retake
                    </button>
                    {held[slot] && (
                      <button
                        type="button"
                        className="btn-ghost-mono pregrade-useanyway"
                        onClick={() => accept(slot, held[slot]!)}
                      >
                        Use anyway
                      </button>
                    )}
                  </div>
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
                accept="image/*,.heic,.heif"
                capture="environment"
                hidden
                onChange={(e) => {
                  pick(slot, e.target.files?.[0]);
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

      {cropTarget &&
        (cropTarget.mode === 'pin' ? (
          (() => {
            const isWhole = cropTarget.slot === 'front' || cropTarget.slot === 'back';
            return (
              <CornerPinCropper
                file={cropTarget.file}
                title={
                  isWhole
                    ? `Pin the card's corners — ${SLOT_META[cropTarget.slot].label}`
                    : `Pin the corner area — ${SLOT_META[cropTarget.slot].label}`
                }
                hint={
                  isWhole
                    ? undefined
                    : 'Drag the pins around the corner you shot — the area gets flattened square'
                }
                outW={isWhole ? undefined : 800}
                outH={isWhole ? undefined : 800}
                detect={isWhole}
                onCancel={() => setCropTarget(null)}
                onUseRectCrop={() => setCropTarget({ ...cropTarget, mode: 'rect' })}
                onDone={(out) => {
                  // Only the whole-card faces count as "flattened" for the
                  // downstream pipeline (guides landing on the photo, the
                  // frame-is-card quality branch). Corner macros just get
                  // the background stripped.
                  void cropped(cropTarget.slot, out.blob, out.url, out.srcLongEdge, isWhole);
                }}
              />
            );
          })()
        ) : (
          <ImageCropper
            file={cropTarget.file}
            outLongEdge={2400}
            title={`Crop to the card — ${SLOT_META[cropTarget.slot].label}`}
            onCancel={() => setCropTarget(null)}
            onDone={(out) => {
              void cropped(cropTarget.slot, out.blob, out.url, undefined, false);
            }}
          />
        ))}
    </main>
  );
}
