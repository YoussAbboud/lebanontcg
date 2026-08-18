import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fitWithin } from '../lib/image';
import { clampOffset, coverScale, frameSize, sourceRect, zoomAt, type Offset } from '../lib/crop';
import './imagecropper.css';

export interface CroppedImage {
  blob: Blob;
  /** Object URL for previewing — caller owns revocation. */
  url: string;
}

interface Props {
  /** The picked file to crop. */
  file: Blob;
  /** Frame and output aspect as width / height (1 = square, 5/7 = card). */
  aspect: number;
  /** Output pixel width; height follows the aspect. */
  outWidth: number;
  title: string;
  /** Overlay a circular guide inside the square (avatars render round). */
  round?: boolean;
  onCancel(): void;
  onDone(out: CroppedImage): void;
}

/** Zoom range on top of the always-covering minimum scale. */
const MAX_ZOOM = 4;
/** Master decode cap — bounds memory, still above every output size. */
const MASTER_LONG_EDGE = 2048;

/**
 * Crop step for every picked photo: the image sits under a fixed frame
 * that marks exactly what will be saved — drag to position, wheel /
 * pinch / slider to zoom. The frame always stays fully covered.
 */
export function ImageCropper({ file, aspect, outWidth, title, round, onCancel, onDone }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live mirrors for event handlers (wheel is a non-React listener, and
  // zoom math must never run inside a state updater — StrictMode would
  // apply it twice).
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  scaleRef.current = scale;
  offsetRef.current = offset;

  // Decode once (EXIF-corrected) into a master canvas: the preview and the
  // final crop both read from it, so what you frame is what you get.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        const { width, height } = fitWithin(bitmap.width, bitmap.height, MASTER_LONG_EDGE);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D unavailable');
        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.92);
        });
        if (cancelled) return;
        masterRef.current = canvas;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setNat({ w: width, h: height });
      } finally {
        bitmap.close();
      }
    })().catch(() => {
      if (!cancelled) setError("Couldn't read that image — try a JPEG or PNG.");
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  // Frame size follows the stage box (and the viewport on resize).
  useEffect(() => {
    const measure = () => {
      const el = stageRef.current;
      if (!el) return;
      setFrame(frameSize(aspect, el.clientWidth - 28, el.clientHeight - 28));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [aspect, previewUrl]);

  const minScale = nat && frame ? coverScale(nat.w, nat.h, frame.width, frame.height) : 1;

  // First open: exactly covering, centred (zoom slider at its minimum).
  // Later geometry changes (viewport resize) re-clamp the current view.
  const initedRef = useRef(false);
  useEffect(() => {
    if (!nat || !frame) return;
    if (!initedRef.current) {
      initedRef.current = true;
      setScale(minScale);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const s = Math.min(Math.max(scaleRef.current, minScale), minScale * MAX_ZOOM);
    setScale(s);
    setOffset((o) => clampOffset(o.x, o.y, nat.w, nat.h, s, frame.width, frame.height));
  }, [nat, frame, minScale]);

  // Esc cancels; body scroll locks while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const applyZoom = useCallback(
    (next: number, cx: number, cy: number) => {
      if (!nat || !frame) return;
      const clamped = Math.min(minScale * MAX_ZOOM, Math.max(minScale, next));
      const o = offsetRef.current;
      const moved = zoomAt(scaleRef.current, clamped, o.x, o.y, cx, cy);
      setScale(clamped);
      setOffset(clampOffset(moved.x, moved.y, nat.w, nat.h, clamped, frame.width, frame.height));
    },
    [nat, frame, minScale],
  );

  // Wheel zoom, anchored at the cursor. Non-passive so the page doesn't scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      applyZoom(scaleRef.current * Math.exp(-e.deltaY * 0.0016), cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);
    if (!prev || !nat || !frame) return;
    const next = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) {
      // Pinch: zoom by the distance ratio, anchored at the midpoint.
      const [a, b] = [...pts.values()];
      const other = a === prev ? b : a;
      const dOld = Math.hypot(prev.x - other.x, prev.y - other.y);
      const dNew = Math.hypot(next.x - other.x, next.y - other.y);
      const rect = stageRef.current!.getBoundingClientRect();
      const midX = (next.x + other.x) / 2 - rect.left - rect.width / 2;
      const midY = (next.y + other.y) / 2 - rect.top - rect.height / 2;
      if (dOld > 0) applyZoom(scaleRef.current * (dNew / dOld), midX, midY);
    } else {
      setOffset((o) =>
        clampOffset(o.x + next.x - prev.x, o.y + next.y - prev.y, nat.w, nat.h, scale, frame.width, frame.height),
      );
    }
    pts.set(e.pointerId, next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  const confirm = async () => {
    const master = masterRef.current;
    if (!master || !nat || !frame || busy) return;
    setBusy(true);
    try {
      const src = sourceRect(nat.w, nat.h, scale, offset.x, offset.y, frame.width, frame.height);
      const outH = Math.round(outWidth / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(master, src.x, src.y, src.width, src.height, 0, 0, outWidth, outH);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85);
      });
      onDone({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("Couldn't save the crop — try again.");
      setBusy(false);
    }
  };

  const zoomValue = minScale > 0 ? scale / minScale : 1;

  return createPortal(
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="crop-panel">
        <div className="crop-head">
          <h2 className="crop-title">{title}</h2>
          <div className="mono-label crop-hint">Drag to position · scroll or pinch to zoom</div>
        </div>

        <div
          ref={stageRef}
          className={`crop-stage ${dragging ? 'is-dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {error ? (
            <p className="field-error crop-error" role="alert">{error}</p>
          ) : previewUrl && nat && frame ? (
            <>
              <img
                className="crop-img"
                src={previewUrl}
                alt=""
                draggable={false}
                style={{
                  width: nat.w * scale,
                  height: nat.h * scale,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
              <div
                className={`crop-frame ${round ? 'crop-frame-round' : ''}`}
                style={{ width: frame.width, height: frame.height }}
                aria-hidden="true"
              />
            </>
          ) : (
            <div className="mono-label crop-loading">Loading photo…</div>
          )}
        </div>

        <div className="crop-zoom">
          <span className="crop-zoom-glyph" aria-hidden="true">−</span>
          <input
            type="range"
            className="crop-slider"
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={Math.min(MAX_ZOOM, Math.max(1, zoomValue))}
            disabled={!nat || Boolean(error)}
            onChange={(e) => applyZoom(minScale * Number(e.target.value), 0, 0)}
          />
          <span className="crop-zoom-glyph" aria-hidden="true">+</span>
        </div>

        <div className="crop-actions">
          <button type="button" className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-acid"
            onClick={() => void confirm()}
            disabled={busy || !nat || Boolean(error)}
          >
            {busy ? 'Saving…' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
