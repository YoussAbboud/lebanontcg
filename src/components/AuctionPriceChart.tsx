import { useMemo, useRef, useState } from 'react';
import type { Auction, Bid } from '../lib/types';
import { formatPrice, relativeTime } from '../lib/format';
import './auctionpricechart.css';

/**
 * Price over the auction's life: a single-series step line from the
 * starting price to the current top bid (price holds between bids, so
 * step-after is the honest form). One series — the title names it, no
 * legend; selective direct labels (start + current only); a crosshair
 * hover names the bid under the pointer. Text wears ink tokens; the
 * line wears the accent.
 */
const W = 640;
const H = 150;
const PAD = { l: 8, r: 8, t: 14, b: 18 };

export function AuctionPriceChart({
  auction,
  bids,
  now,
}: {
  auction: Auction;
  /** Any order — the chart sorts ascending by time. */
  bids: Bid[];
  now: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; bid: Bid } | null>(null);

  const model = useMemo(() => {
    const asc = [...bids].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const t0 = new Date(auction.createdAt).getTime();
    const tEnd = Math.max(
      auction.status === 'live' ? now : new Date(auction.endsAt).getTime(),
      asc.length ? new Date(asc[asc.length - 1].createdAt).getTime() : t0 + 1,
      t0 + 1,
    );
    const vMax = asc.length ? asc[asc.length - 1].amount : auction.startingPrice;
    const vMin = auction.startingPrice;
    const span = Math.max(vMax - vMin, vMin * 0.02, 1);
    const x = (t: number) =>
      PAD.l + ((t - t0) / (tEnd - t0)) * (W - PAD.l - PAD.r);
    const y = (v: number) =>
      H - PAD.b - ((v - vMin) / span) * (H - PAD.t - PAD.b);
    // Step-after: hold each price until the next bid lands.
    const pts = [
      { t: t0, v: auction.startingPrice },
      ...asc.map((b) => ({ t: new Date(b.createdAt).getTime(), v: b.amount })),
    ];
    let d = `M ${x(pts[0].t)} ${y(pts[0].v)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` H ${x(pts[i].t)} V ${y(pts[i].v)}`;
    }
    d += ` H ${x(tEnd)}`;
    return { asc, t0, tEnd, vMax, x, y, d };
  }, [auction, bids, now]);

  const { asc, x, y, d, vMax, t0, tEnd } = model;
  const current = asc.length ? asc[asc.length - 1] : null;

  const onMove = (e: React.PointerEvent) => {
    if (!svgRef.current || asc.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = asc[0];
    let best = Infinity;
    for (const b of asc) {
      const dx = Math.abs(x(new Date(b.createdAt).getTime()) - px);
      if (dx < best) {
        best = dx;
        nearest = b;
      }
    }
    setHover({ x: x(new Date(nearest.createdAt).getTime()), bid: nearest });
  };

  const gridYs = [0.5];

  return (
    <figure
      className="aucchart"
      role="img"
      aria-label={`Bid price over time: started at ${formatPrice(auction.startingPrice, auction.currency)}, now ${formatPrice(vMax, auction.currency)} after ${asc.length} bid${asc.length === 1 ? '' : 's'}`}
    >
      <figcaption className="mono-label aucchart-title">Bid price · start → now</figcaption>
      <div className="aucchart-stage">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {gridYs.map((g) => {
            const gy = PAD.t + g * (H - PAD.t - PAD.b);
            return <line key={g} className="aucchart-grid" x1={PAD.l} x2={W - PAD.r} y1={gy} y2={gy} />;
          })}
          <line
            className="aucchart-grid"
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(auction.startingPrice)}
            y2={y(auction.startingPrice)}
          />
          <path className="aucchart-line" d={d} />
          {hover && (
            <line
              className="aucchart-crosshair"
              x1={hover.x}
              x2={hover.x}
              y1={PAD.t}
              y2={H - PAD.b}
            />
          )}
          {current && (
            <circle
              className="aucchart-dot"
              cx={x(Math.min(new Date(current.createdAt).getTime(), tEnd))}
              cy={y(current.amount)}
              r="4"
            />
          )}
          {hover && (
            <circle
              className="aucchart-dot is-hover"
              cx={hover.x}
              cy={y(hover.bid.amount)}
              r="3"
            />
          )}
        </svg>
        {hover && (
          <div
            className="aucchart-tip glass"
            style={{ left: `${(hover.x / W) * 100}%` }}
            role="status"
          >
            <span className="aucchart-tip-name">{hover.bid.bidderName}</span>
            <span className="mono-value">{formatPrice(hover.bid.amount, auction.currency)}</span>
            <span className="mono-label aucchart-tip-when">{relativeTime(hover.bid.createdAt)}</span>
          </div>
        )}
      </div>
      <div className="aucchart-labels">
        <span className="mono-label">
          Started {formatPrice(auction.startingPrice, auction.currency)} · {relativeTime(new Date(t0).toISOString())}
        </span>
        <span className="mono-value aucchart-current">
          {formatPrice(vMax, auction.currency)}
        </span>
      </div>
    </figure>
  );
}
