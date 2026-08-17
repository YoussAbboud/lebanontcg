import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { formatPrice, relativeTime } from '../lib/format';
import { sellerDotBackground, faceBackground, glyphOf } from '../lib/face';
import './fancarousel.css';

// The Sleeved hero: up to 7 cards fanned in 3D perspective. Offsets,
// rotations, depths, brightness and timing are lifted verbatim from the
// design component. Auto-advances every 5s; hover/focus pauses and lifts
// a card; the centre (or hovered) card reveals its info panel. The
// hovered card tilts toward the cursor (parallax) and the whole fan can
// be dragged/swiped to slide between cards.
const X = [0, 60, 106, 142];
const ROT = [0, 18, 27, 33];
const Z = [0, 60, 110, 160];

/** Degrees of cursor tilt on the hovered card, and the photo counter-shift. */
const TILT_X = 10; // rotateX from vertical cursor position
const TILT_Y = 14; // rotateY from horizontal cursor position
const PARALLAX_PX = 9;

/** Dragging: pixels per card step, and the minimum to count as a swipe. */
const DRAG_STEP = 140;
const DRAG_MIN = 45;

export function FanCarousel({ items }: { items: ListingWithSeller[] }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(Math.min(2, Math.max(0, items.length - 1)));
  const [hovered, setHovered] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [dragDx, setDragDx] = useState(0);
  const hoveredRef = useRef(hovered);
  const pausedRef = useRef(paused);
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  hoveredRef.current = hovered;
  pausedRef.current = paused;

  const n = items.length;

  useEffect(() => {
    if (n < 2 || reduced) return;
    const id = window.setInterval(() => {
      if (hoveredRef.current !== null || pausedRef.current) return;
      setActive((a) => (a + 1) % n);
    }, 5000);
    return () => window.clearInterval(id);
  }, [n, reduced]);

  if (n === 0) return null;

  const step = (delta: number) => setActive((a) => (((a + delta) % n) + n) % n);

  // ---- drag / swipe (mouse and touch, via pointer events) -----------------
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { startX: e.clientX, moved: false };
    setPaused(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 8) d.moved = true;
    if (d.moved) setDragDx(Math.max(-220, Math.min(220, dx)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragDx(0);
    if (e.pointerType !== 'mouse') setPaused(false);
    if (!d?.moved) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) < DRAG_MIN) return;
    // Drag left → the fan slides left → the next card comes forward.
    const steps = Math.max(1, Math.round(Math.abs(dx) / DRAG_STEP));
    step(dx < 0 ? steps : -steps);
  };

  const dragging = dragRef.current?.moved ?? false;

  return (
    <section aria-label="Recently listed" className="fan-section">
      <div className="fan-floor" aria-hidden="true" />
      <div
        className="fan-stage"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          setPaused(false);
          setHovered(null);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {items.map((item, i) => {
          let off = (((i - active) % n) + n) % n;
          if (off > (n - 1) / 2) off -= n;
          const abs = Math.min(Math.abs(off), 3);
          const isCentre = off === 0;
          const isHot = hovered === i || (hovered === null && isCentre);
          const isTilting = hovered === i && !reduced && !dragging;
          const scale = (isCentre ? 1 : 1 - abs * 0.1) * (hovered === i ? 1.09 : 1);
          const sign = off < 0 ? -1 : 1;
          const cover = item.images[0];
          const handle = item.seller.username
            ? `@${item.seller.username}`
            : item.seller.displayName;
          const tiltTerm = isTilting
            ? ` rotateX(${(-tilt.y * TILT_X).toFixed(2)}deg) rotateY(${(tilt.x * TILT_Y).toFixed(2)}deg)`
            : '';
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${item.title} — asking ${formatPrice(item.price, item.currency)}`}
              className={`fan-card ${isCentre ? 'fan-card-centre' : ''}`}
              style={{
                transform:
                  `translate(-50%, -50%) translateX(${dragDx}px) translateX(${sign * X[abs]}%)` +
                  ` translateZ(${-Z[abs] + (hovered === i ? 90 : 0)}px)` +
                  ` rotateY(${sign * ROT[abs]}deg)${tiltTerm} scale(${scale.toFixed(3)})`,
                filter: `brightness(${(isHot ? 1 : 1 - abs * 0.22).toFixed(2)})`,
                zIndex: 10 - abs + (hovered === i ? 5 : 0),
                // The fan settles slowly; the cursor tilt and a live drag
                // must track the pointer, so they get a fast transition.
                transition:
                  isTilting || dragDx !== 0
                    ? 'transform 130ms var(--ease-out), filter var(--t-fast)'
                    : undefined,
              }}
              onClick={() => {
                if (dragRef.current?.moved) return; // a drag, not a click
                navigate(`/listing/${item.id}`);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/listing/${item.id}`);
              }}
              onMouseEnter={() => {
                setHovered(i);
                setTilt({ x: 0, y: 0 });
              }}
              onMouseLeave={() => setHovered(null)}
              onMouseMove={(e) => {
                if (hovered !== i || reduced) return;
                const r = e.currentTarget.getBoundingClientRect();
                setTilt({
                  x: (e.clientX - r.left) / r.width - 0.5,
                  y: (e.clientY - r.top) / r.height - 0.5,
                });
              }}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
            >
              <div
                className="fan-face"
                style={cover ? undefined : { background: faceBackground(item.id) }}
              >
                {cover ? (
                  <img
                    className="fan-photo"
                    src={cover.url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    style={
                      isTilting
                        ? {
                            transform: `translate(${(-tilt.x * PARALLAX_PX).toFixed(1)}px, ${(-tilt.y * PARALLAX_PX).toFixed(1)}px) scale(1.07)`,
                          }
                        : undefined
                    }
                  />
                ) : (
                  <div className="fan-glyph" aria-hidden="true">
                    {glyphOf(item.title)}
                  </div>
                )}
                <div className="fan-scrim" aria-hidden="true" />
                <div className="fan-caption">
                  <div className="fan-title">{item.title}</div>
                  <div className={`fan-info ${isHot ? 'fan-info-open' : ''}`}>
                    <div className="fan-seller-row">
                      <div
                        className="fan-dot"
                        style={{ background: sellerDotBackground(handle) }}
                        aria-hidden="true"
                      />
                      <div className="fan-handle">{handle}</div>
                    </div>
                    <div className="fan-asking-row">
                      <span className="fan-asking mono-value">
                        {formatPrice(item.price, item.currency)}
                      </span>
                    </div>
                    <div className="fan-foot">
                      <div className="fan-more">More →</div>
                      <div className="fan-listed mono-label">{relativeTime(item.createdAt)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="fan-dots">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Show ${item.title}`}
            className={`fan-dotbtn ${i === active ? 'fan-dotbtn-on' : ''}`}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </section>
  );
}
