import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { formatPrice, relativeTime } from '../lib/format';
import { sellerDotBackground, faceBackground, glyphOf } from '../lib/face';
import './fancarousel.css';

// The Sleeved hero: up to 7 cards fanned in 3D perspective. Offsets,
// rotations, depths, brightness and timing are lifted verbatim from the
// design component. Auto-advances every 5s; hover/focus pauses and lifts
// a card; the centre (or hovered) card reveals its info panel.
const X = [0, 60, 106, 142];
const ROT = [0, 18, 27, 33];
const Z = [0, 60, 110, 160];

export function FanCarousel({ items }: { items: ListingWithSeller[] }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(Math.min(2, Math.max(0, items.length - 1)));
  const [hovered, setHovered] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const hoveredRef = useRef(hovered);
  const pausedRef = useRef(paused);
  hoveredRef.current = hovered;
  pausedRef.current = paused;

  const n = items.length;

  useEffect(() => {
    if (n < 2) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      if (hoveredRef.current !== null || pausedRef.current) return;
      setActive((a) => (a + 1) % n);
    }, 5000);
    return () => window.clearInterval(id);
  }, [n]);

  if (n === 0) return null;

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
      >
        {items.map((item, i) => {
          let off = (((i - active) % n) + n) % n;
          if (off > (n - 1) / 2) off -= n;
          const abs = Math.min(Math.abs(off), 3);
          const isCentre = off === 0;
          const isHot = hovered === i || (hovered === null && isCentre);
          const scale = (isCentre ? 1 : 1 - abs * 0.1) * (hovered === i ? 1.09 : 1);
          const sign = off < 0 ? -1 : 1;
          const cover = item.images[0];
          const handle = item.seller.username
            ? `@${item.seller.username}`
            : item.seller.displayName;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${item.title} — asking ${formatPrice(item.price, item.currency)}`}
              className={`fan-card ${isCentre ? 'fan-card-centre' : ''}`}
              style={{
                transform:
                  `translate(-50%, -50%) translateX(${sign * X[abs]}%)` +
                  ` translateZ(${-Z[abs] + (hovered === i ? 90 : 0)}px)` +
                  ` rotateY(${sign * ROT[abs]}deg) scale(${scale.toFixed(3)})`,
                filter: `brightness(${(isHot ? 1 : 1 - abs * 0.22).toFixed(2)})`,
                zIndex: 10 - abs + (hovered === i ? 5 : 0),
              }}
              onClick={() => navigate(`/listing/${item.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/listing/${item.id}`);
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
            >
              <div
                className="fan-face"
                style={cover ? undefined : { background: faceBackground(item.id) }}
              >
                {cover ? (
                  <img className="fan-photo" src={cover.url} alt="" loading="lazy" />
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
                      <div className="fan-listed mono-label">{relativeTime(item.createdAt)}</div>
                    </div>
                    <div className="fan-asking-row">
                      <span className="mono-label">Asking</span>
                      <span className="fan-asking mono-value">
                        {formatPrice(item.price, item.currency)}
                      </span>
                    </div>
                    <div className="fan-more">More →</div>
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
