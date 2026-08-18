import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fitWithin } from '../lib/image';
import {
  clampOffset,
  coverScale,
  frameSize,
  moveRect,
  resizeRect,
  sourceRect,
  zoomAt,
  type CropHandle,
  type Offset,
  type Rect,
} from '../lib/crop';
import './imagecropper.css';
import { toDecodableBlob } from '../lib/heic';

export interface CroppedImage {
  blob: Blob;
  /** Object URL for previewing — caller owns revocation. */
  url: string;
}

interface Props {
  /** The picked file to crop. */
  file: Blob;
  /**
   * Fixed frame aspect as width / height (1 = square avatar). Omit for a
   * free crop: the whole image is shown with a resizable selection.
   */
  aspect?: number;
  /** Fixed mode: output pixel width (height follows the aspect). */
  outWidth?: number;
  /** Free mode: output long-edge cap. */
  outLongEdge?: number;
  title: string;
  /** Overlay a circular guide inside the square (avatars render round). */
  round?: boolean;
  onCancel(): void;
  onDone(out: CroppedImage): void;
}

/** Fixed mode: zoom range on top of the always-covering minimum scale. */
const MAX_ZOOM = 4;
/** Master decode cap — bounds memory, still above every output size. */
const MASTER_LONG_EDGE = 2048;
/** Free mode: minimum selection edge, in display px. */
const MIN_SEL_CSS = 36;
/** Free mode: default output long edge. */
const FREE_OUT_LONG_EDGE = 1600;

const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * Crop step for every picked photo. Fixed mode (avatars): the image sits
 * under a fixed frame — drag to position, wheel / pinch / slider to zoom;
 * the frame always stays covered. Free mode (listing photos): the whole
 * image is shown and a bordered selection with corner/edge handles marks
 * exactly what will be saved — any shape the user wants.
 */
export function ImageCropper({
  file,
  aspect,
  outWidth,
  outLongEdge,
  title,
  round,
  onCancel,
  onDone,
}: Props) {
  const free = aspect === undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [stageBox, setStageBox] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [sel, setSel] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live mirrors for event handlers (wheel is a non-React listener, and
  // zoom math must never run inside a state updater — StrictMode would
  // apply it twice).
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const selRef = useRef(sel);
  scaleRef.current = scale;
  offsetRef.current = offset;
  selRef.current = sel;
  // Free mode: what the active pointer is doing.
  const actionRef = useRef<{ kind: 'move' } | { kind: 'resize'; handle: CropHandle } | null>(null);

  // Decode once (EXIF-corrected) into a master canvas: the preview and the
  // final crop both read from it, so what you frame is what you get.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      const bitmap = await createImageBitmap(await toDecodableBlob(file), {
        imageOrientation: 'from-image',
      });
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
      if (!cancelled) setError("Couldn't read that image — try a JPEG, PNG or HEIC.");
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  // Stage box follows the viewport.
  useEffect(() => {
    const measure = () => {
      const el = stageRef.current;
      if (!el) return;
      setStageBox({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [previewUrl]);

  // ---- fixed-frame geometry ----------------------------------------------
  const frame =
    aspect !== undefined && stageBox ? frameSize(aspect, stageBox.w - 28, stageBox.h - 28) : null;
  const minScale = nat && frame ? coverScale(nat.w, nat.h, frame.width, frame.height) : 1;

  // ---- free-mode geometry: image fitted (contained) in the stage ----------
  const fit =
    free && nat && stageBox
      ? (() => {
          const s = Math.min((stageBox.w - 28) / nat.w, (stageBox.h - 28) / nat.h);
          const iw = nat.w * s;
          const ih = nat.h * s;
          return { s, iw, ih, ox: (stageBox.w - iw) / 2, oy: (stageBox.h - ih) / 2 };
        })()
      : null;
  const fitRef = useRef(fit);
  fitRef.current = fit;

  // First open: fixed mode starts exactly covering and centred; free mode
  // starts with the whole image selected. Resizes re-clamp the fixed view.
  const initedRef = useRef(false);
  useEffect(() => {
    if (!nat) return;
    if (free) {
      if (!initedRef.current) {
        initedRef.current = true;
        setSel({ x: 0, y: 0, w: nat.w, h: nat.h });
      }
      return;
    }
    if (!frame) return;
    if (!initedRef.current) {
      initedRef.current = true;
      setScale(minScale);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const s = Math.min(Math.max(scaleRef.current, minScale), minScale * MAX_ZOOM);
    setScale(s);
    setOffset((o) => clampOffset(o.x, o.y, nat.w, nat.h, s, frame.width, frame.height));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frame is derived; stageBox drives it
  }, [nat, free, stageBox, minScale]);

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

  // Fixed mode: wheel zoom anchored at the cursor (non-passive so the page
  // doesn't scroll behind the dialog).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || free) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      applyZoom(scaleRef.current * Math.exp(-e.deltaY * 0.0016), cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom, free]);

  // Free mode: what would this stage point grab — a handle, the selection?
  const hitTest = (px: number, py: number): { kind: 'move' } | { kind: 'resize'; handle: CropHandle } | null => {
    const f = fitRef.current;
    const s0 = selRef.current;
    if (!f || !s0) return null;
    const rx = f.ox + s0.x * f.s;
    const ry = f.oy + s0.y * f.s;
    const rw = s0.w * f.s;
    const rh = s0.h * f.s;
    const pos: Record<CropHandle, [number, number]> = {
      nw: [rx, ry], n: [rx + rw / 2, ry], ne: [rx + rw, ry],
      e: [rx + rw, ry + rh / 2], se: [rx + rw, ry + rh],
      s: [rx + rw / 2, ry + rh], sw: [rx, ry + rh], w: [rx, ry + rh / 2],
    };
    for (const h of HANDLES) {
      const [hx, hy] = pos[h];
      if (Math.abs(px - hx) <= 16 && Math.abs(py - hy) <= 16) return { kind: 'resize', handle: h };
    }
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return { kind: 'move' };
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (free) {
      const rect = stageRef.current!.getBoundingClientRect();
      const act = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (!act) return;
      actionRef.current = act;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);
    if (!prev || !nat) return;
    const next = { x: e.clientX, y: e.clientY };
    if (free) {
      const f = fitRef.current;
      const s0 = selRef.current;
      const act = actionRef.current;
      if (f && s0 && act) {
        const dx = (next.x - prev.x) / f.s;
        const dy = (next.y - prev.y) / f.s;
        const minEdge = MIN_SEL_CSS / f.s;
        setSel(
          act.kind === 'move'
            ? moveRect(s0, dx, dy, nat.w, nat.h)
            : resizeRect(s0, act.handle, dx, dy, nat.w, nat.h, minEdge),
        );
      }
    } else if (frame) {
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
    }
    pts.set(e.pointerId, next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      actionRef.current = null;
    }
  };

  const confirm = async () => {
    const master = masterRef.current;
    if (!master || !nat || busy) return;
    setBusy(true);
    try {
      let src: { x: number; y: number; width: number; height: number };
      let out: { width: number; height: number };
      if (free) {
        if (!sel) return;
        src = { x: sel.x, y: sel.y, width: sel.w, height: sel.h };
        out = fitWithin(sel.w, sel.h, outLongEdge ?? FREE_OUT_LONG_EDGE);
      } else {
        if (!frame || !outWidth || aspect === undefined) return;
        src = sourceRect(nat.w, nat.h, scale, offset.x, offset.y, frame.width, frame.height);
        out = { width: outWidth, height: Math.round(outWidth / aspect) };
      }
      const canvas = document.createElement('canvas');
      canvas.width = out.width;
      canvas.height = out.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(master, src.x, src.y, src.width, src.height, 0, 0, out.width, out.height);
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
  const ready = Boolean(previewUrl && nat && (free ? fit && sel : frame));

  return createPortal(
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="crop-panel">
        <div className="crop-head">
          <h2 className="crop-title">{title}</h2>
          <div className="mono-label crop-hint">
            {free
              ? 'Drag the corners to frame · drag inside to move'
              : 'Drag to position · scroll or pinch to zoom'}
          </div>
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
          ) : ready && free && fit && sel ? (
            <>
              <img
                className="crop-img crop-img-fit"
                src={previewUrl!}
                alt=""
                draggable={false}
                style={{ left: fit.ox, top: fit.oy, width: fit.iw, height: fit.ih }}
              />
              <div
                className="crop-sel"
                style={{
                  left: fit.ox + sel.x * fit.s,
                  top: fit.oy + sel.y * fit.s,
                  width: sel.w * fit.s,
                  height: sel.h * fit.s,
                }}
                aria-hidden="true"
              >
                {HANDLES.map((h) => (
                  <span key={h} className={`crop-handle crop-handle-${h}`} />
                ))}
              </div>
            </>
          ) : ready && !free && nat && frame ? (
            <>
              <img
                className="crop-img"
                src={previewUrl!}
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

        {!free && (
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
        )}

        <div className="crop-actions">
          <button type="button" className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-acid"
            onClick={() => void confirm()}
            disabled={busy || !ready || Boolean(error)}
          >
            {busy ? 'Saving…' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
