import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './imagelightbox.css';

interface Props {
  images: { id: string; url: string }[];
  index: number;
  alt: string;
  onIndexChange(next: number): void;
  onClose(): void;
}

const ZOOM = 2.4;

/**
 * Full-screen photo viewer. Click/tap the image to toggle zoom (anchored
 * to the point you pressed), drag to pan while zoomed, arrows or swipe to
 * move between photos, Esc or the backdrop to close.
 */
export function ImageLightbox({ images, index, alt, onIndexChange, onClose }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  // A pan ends with a click event on the image; without this the release
  // would immediately toggle the zoom back off.
  const draggedRef = useRef(false);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const image = images[index];
  const many = images.length > 1;

  const step = useCallback(
    (delta: number) => {
      setZoomed(false);
      setPan({ x: 0, y: 0 });
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  // Keyboard + scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && many) step(1);
      else if (e.key === 'ArrowLeft' && many) step(-1);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const restoreFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      restoreFocus?.focus?.();
    };
  }, [onClose, step, many]);

  const toggleZoom = (e: React.MouseEvent<HTMLImageElement>) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (zoomed) {
      setZoomed(false);
      setPan({ x: 0, y: 0 });
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
    setPan({ x: 0, y: 0 });
    setZoomed(true);
  };

  // Drag to pan (pointer events cover mouse, pen and touch).
  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomed) return;
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    // A few pixels of travel is a shaky click, not a drag.
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
    setPan({ x: d.panX + dx, y: d.panY + dy });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  /**
   * Click anywhere that isn't the photo or a control to close — the
   * backdrop, the margins around the photo, the bar, the hint. Checking
   * the event target rather than `e.target === e.currentTarget` matters:
   * the empty space belongs to the grid children, not the root.
   */
  const onSurfaceClick = (e: React.MouseEvent) => {
    if (draggedRef.current) {
      // A pan that ended off the photo — not a click on the backdrop.
      draggedRef.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('.lbox-img') || target.closest('button')) return;
    onClose();
  };

  // Swipe between photos when not zoomed.
  const onTouchStart = (e: React.TouchEvent) => {
    if (zoomed || !many) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s || zoomed || !many) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) > 45 && Math.abs(t.clientY - s.y) < 60 && Date.now() - s.t < 700) {
      step(dx < 0 ? 1 : -1);
    }
  };

  if (!image) return null;

  // Portalled to <body>: .shell-main is a stacking context (position:
  // relative, z-index: 1), so a modal rendered inside a page would sit
  // *under* the header no matter how high its z-index.
  return createPortal(
    <div
      className="lbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onSurfaceClick}
    >
      <div className="lbox-bar">
        {many && (
          <span className="mono-label lbox-count">
            {index + 1} / {images.length}
          </span>
        )}
        <button
          ref={closeRef}
          type="button"
          className="btn-icon lbox-close"
          aria-label="Close photo viewer"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {many && (
        <button
          type="button"
          className="btn-icon lbox-nav lbox-prev"
          aria-label="Previous photo"
          onClick={() => step(-1)}
        >
          ←
        </button>
      )}

      <div className="lbox-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img
          className={`lbox-img ${zoomed ? 'is-zoomed' : ''}`}
          src={image.url}
          alt={alt}
          draggable={false}
          style={
            zoomed
              ? {
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${ZOOM})`,
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                }
              : undefined
          }
          onClick={toggleZoom}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {many && (
        <button
          type="button"
          className="btn-icon lbox-nav lbox-next"
          aria-label="Next photo"
          onClick={() => step(1)}
        >
          →
        </button>
      )}

      {/* Wording differs by input device; CSS picks one (see lbox-hint). */}
      <div className="mono-label lbox-hint">
        <span className="lbox-hint-pointer">
          {zoomed
            ? 'Drag to pan · click to zoom out'
            : 'Click the photo to zoom · click outside to close'}
        </span>
        <span className="lbox-hint-touch">
          {zoomed
            ? 'Drag to pan · tap to zoom out'
            : `Tap the photo to zoom${many ? ' · swipe to browse' : ''} · tap outside to close`}
        </span>
      </div>
    </div>,
    document.body,
  );
}
