import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { blobToRaster, drawRasterTo } from '../../lib/pregrade/decode';
import { detectCardQuad } from '../../lib/pregrade/centering';
import { warpQuad, type Point, type Raster } from '../../lib/pregrade/raster';

/** Flattened output: the card's true 2.5:3.5 aspect at analysis size. */
const OUT_W = 1000;
const OUT_H = 1400;

const HANDLE_LABELS = ['Top-left corner', 'Top-right corner', 'Bottom-right corner', 'Bottom-left corner'];

/**
 * Corner pinning for the flat-on card shots: drag the four pins onto
 * the card's actual corners — each corner is free, nothing has to be
 * 90° — and the selection is flattened (perspective-warped) into a
 * perfect card rectangle. The background never reaches the analysis,
 * and camera angle is corrected by the user's own corner placement.
 */
export function CornerPinCropper({
  file,
  title,
  onCancel,
  onDone,
}: {
  file: Blob;
  title: string;
  onCancel(): void;
  onDone(out: { blob: Blob; url: string; srcLongEdge: number }): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rasterRef = useRef<Raster | null>(null);
  const dragRef = useRef<{ index: number; lastX: number; lastY: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const origLongRef = useRef(0);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { raster, originalLongEdge } = await blobToRaster(file, 2400);
      if (cancelled) return;
      origLongRef.current = originalLongEdge;
      rasterRef.current = raster;
      setSize({ w: raster.width, h: raster.height });
      if (canvasRef.current) drawRasterTo(canvasRef.current, raster);
      // Pre-place the pins on the detected outline when there is one —
      // otherwise a comfortable inset the user drags out to the corners.
      const found = detectCardQuad(raster);
      const inset = 0.12;
      setCorners(
        found
          ? found.quad
          : [
              { x: raster.width * inset, y: raster.height * inset },
              { x: raster.width * (1 - inset), y: raster.height * inset },
              { x: raster.width * (1 - inset), y: raster.height * (1 - inset) },
              { x: raster.width * inset, y: raster.height * (1 - inset) },
            ],
      );
    })().catch(() => {
      if (!cancelled) setError("Couldn't read that image — try a JPEG or PNG.");
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

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

  const imageScale = () => {
    const el = frameRef.current;
    if (!el || !size || el.clientWidth === 0) return 1;
    return size.w / el.clientWidth;
  };

  const moveCorner = (index: number, dxImg: number, dyImg: number) => {
    setCorners((prev) => {
      if (!prev || !size) return prev;
      const next = prev.map((p, i) =>
        i === index
          ? {
              x: Math.min(size.w - 1, Math.max(0, p.x + dxImg)),
              y: Math.min(size.h - 1, Math.max(0, p.y + dyImg)),
            }
          : p,
      );
      return next;
    });
  };

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    dragRef.current = { index, lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const s = imageScale();
    moveCorner(d.index, (e.clientX - d.lastX) * s, (e.clientY - d.lastY) * s);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const flatten = async () => {
    const raster = rasterRef.current;
    if (!raster || !corners || busy) return;
    setBusy(true);
    try {
      const card = warpQuad(raster, corners, OUT_W, OUT_H);
      const canvas = document.createElement('canvas');
      drawRasterTo(canvas, card);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('encode failed');
      // How many SOURCE pixels the pinned card actually spans — the
      // honest resolution (the flattened output is always 1000×1400,
      // even from a tiny photo).
      const side = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
      const maxSide = Math.max(
        side(corners[0], corners[1]),
        side(corners[1], corners[2]),
        side(corners[2], corners[3]),
        side(corners[3], corners[0]),
      );
      const scaleUp = origLongRef.current / Math.max(raster.width, raster.height);
      onDone({ blob, url: URL.createObjectURL(blob), srcLongEdge: maxSide * scaleUp });
    } catch {
      setError("Couldn't flatten the card — try again.");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="crop-panel">
        <div className="crop-head">
          <h2 className="crop-title">{title}</h2>
          <div className="mono-label crop-hint">
            Drag each pin onto the card&apos;s corner — the shot gets flattened to a perfect card
          </div>
        </div>

        <div
          className="pin-stage"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div ref={frameRef} className="pin-frame">
            <canvas ref={canvasRef} className="pin-canvas" />
          {error && (
            <p className="field-error crop-error" role="alert">{error}</p>
          )}
          {size && corners && (
            <>
              <svg
                className="pin-lines"
                viewBox={`0 0 ${size.w} ${size.h}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} />
              </svg>
              {corners.map((p, i) => (
                <div
                  key={i}
                  role="slider"
                  tabIndex={0}
                  aria-label={HANDLE_LABELS[i]}
                  aria-valuenow={Math.round(p.x)}
                  className="pin-handle"
                  style={{ left: `${(p.x / size.w) * 100}%`, top: `${(p.y / size.h) * 100}%` }}
                  onPointerDown={onPointerDown(i)}
                  onKeyDown={(e) => {
                    const step = (e.shiftKey ? 5 : 1) * imageScale();
                    if (e.key === 'ArrowLeft') moveCorner(i, -step, 0);
                    else if (e.key === 'ArrowRight') moveCorner(i, step, 0);
                    else if (e.key === 'ArrowUp') moveCorner(i, 0, -step);
                    else if (e.key === 'ArrowDown') moveCorner(i, 0, step);
                    else return;
                    e.preventDefault();
                  }}
                />
              ))}
            </>
          )}
          {!size && !error && <div className="mono-label crop-loading">Loading photo…</div>}
          </div>
        </div>

        <div className="crop-actions">
          <button type="button" className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-acid"
            disabled={busy || !corners || Boolean(error)}
            onClick={() => void flatten()}
          >
            {busy ? 'Flattening…' : 'Flatten card'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
