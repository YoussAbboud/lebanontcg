import { useEffect, useMemo, useRef, useState } from 'react';
import { blobToRaster } from '../../lib/pregrade/decode';
import { drawRasterTo } from '../../lib/pregrade/decode';
import {
  CANONICAL_H,
  CANONICAL_W,
  detectCardQuad,
  detectInnerBorders,
  scoreBackCentering,
  scoreFrontCentering,
  worseAxis,
} from '../../lib/pregrade/centering';
import { warpQuad, type Point, type Raster } from '../../lib/pregrade/raster';
import { axisRatio } from '../../lib/pregrade/centering';
import type { AxisRatio, CenteringMethod } from '../../lib/pregrade/types';

/** Warped working buffer: card + margin so outer guides can be nudged. */
const CARD_W = 400;
const CARD_H = 560;
const MARGIN = 36;
const BUF_W = CARD_W + MARGIN * 2;
const BUF_H = CARD_H + MARGIN * 2;

/** Physical card size, for the mm-equivalent readout. */
const CARD_MM_W = 63;
const CARD_MM_H = 88;

export interface CenteringOutcome {
  ratios: { leftRight: AxisRatio; topBottom: AxisRatio };
  method: CenteringMethod;
  score: number;
  /** Measured border thicknesses (editor px) — drives the diagram. */
  borders: { left: number; right: number; top: number; bottom: number };
}

interface Guides {
  outL: number;
  outR: number;
  outT: number;
  outB: number;
  inL: number;
  inR: number;
  inT: number;
  inB: number;
}

type GuideKey = keyof Guides;
const VERTICAL: GuideKey[] = ['outL', 'outR', 'inL', 'inR'];

const GUIDE_LABELS: Record<GuideKey, string> = {
  outL: 'Card left edge',
  outR: 'Card right edge',
  outT: 'Card top edge',
  outB: 'Card bottom edge',
  inL: 'Left border line',
  inR: 'Right border line',
  inT: 'Top border line',
  inB: 'Bottom border line',
};

/**
 * Perspective-corrected card with eight draggable guides — outer edges
 * auto-placed, inner guides at the detected border. Manual adjustment
 * is a first-class path, not a fallback: detection fails on borderless
 * and dark-bordered cards by design.
 */
export function CenteringEditor({
  face,
  blob,
  onDone,
  onBack,
}: {
  face: 'front' | 'back';
  blob: Blob;
  onDone(result: CenteringOutcome): void;
  onBack(): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready'>('loading');
  const [autoDetected, setAutoDetected] = useState(false);
  const [bordersDetected, setBordersDetected] = useState(false);
  const [userMoved, setUserMoved] = useState(false);
  const [borderless, setBorderless] = useState(false);
  const [guides, setGuides] = useState<Guides>({
    outL: MARGIN,
    outR: MARGIN + CARD_W,
    outT: MARGIN,
    outB: MARGIN + CARD_H,
    inL: MARGIN + 30,
    inR: MARGIN + CARD_W - 30,
    inT: MARGIN + 34,
    inB: MARGIN + CARD_H - 34,
  });
  const dragRef = useRef<{ key: GuideKey; lastX: number; lastY: number } | null>(null);

  // Decode → detect → warp (with margin) → detect inner borders.
  useEffect(() => {
    let cancelled = false;
    // The wizard reuses this component instance across faces — reset
    // everything the previous face touched before measuring the new one.
    setState('loading');
    setAutoDetected(false);
    setBordersDetected(false);
    setUserMoved(false);
    setBorderless(false);
    setGuides({
      outL: MARGIN,
      outR: MARGIN + CARD_W,
      outT: MARGIN,
      outB: MARGIN + CARD_H,
      inL: MARGIN + 30,
      inR: MARGIN + CARD_W - 30,
      inT: MARGIN + 34,
      inB: MARGIN + CARD_H - 34,
    });
    (async () => {
      // Measure at (near) full resolution — the canvas downscale path
      // biases thin borders in a way the raw pixels don't.
      const { raster } = await blobToRaster(blob, 2400);
      if (cancelled) return;
      const found = detectCardQuad(raster);
      let buffer: Raster;
      if (found) {
        // Expand the quad about its centre so the buffer carries margin —
        // the outer guides stay adjustable after the warp.
        const cx = found.quad.reduce((s, p) => s + p.x, 0) / 4;
        const cy = found.quad.reduce((s, p) => s + p.y, 0) / 4;
        const fx = (CARD_W + 2 * MARGIN) / CARD_W;
        const expanded: Point[] = found.quad.map((p) => ({
          x: cx + (p.x - cx) * fx,
          y: cy + (p.y - cy) * ((CARD_H + 2 * MARGIN) / CARD_H),
        }));
        buffer = warpQuad(raster, expanded, BUF_W, BUF_H);
        setAutoDetected(true);
      } else {
        // No quad: show the raw shot fitted to the buffer; every guide is
        // manual. Not an error state — just a different starting point.
        buffer = warpQuad(
          raster,
          [
            { x: 0, y: 0 },
            { x: raster.width, y: 0 },
            { x: raster.width, y: raster.height },
            { x: 0, y: raster.height },
          ],
          BUF_W,
          BUF_H,
        );
        setAutoDetected(false);
      }
      if (cancelled) return;
      if (canvasRef.current) drawRasterTo(canvasRef.current, buffer);
      if (found) {
        // Detect at the engine's canonical resolution (thin borders need
        // the pixels), then scale the positions into the editor buffer.
        const cardOnly = warpQuad(raster, found.quad, CANONICAL_W, CANONICAL_H);
        const b = detectInnerBorders(cardOnly);
        if (b) {
          const sx = CARD_W / CANONICAL_W;
          const sy = CARD_H / CANONICAL_H;
          setGuides((g) => ({
            ...g,
            inL: MARGIN + b.left * sx,
            inR: MARGIN + CARD_W - b.right * sx,
            inT: MARGIN + b.top * sy,
            inB: MARGIN + CARD_H - b.bottom * sy,
          }));
          setBordersDetected(true);
        }
      }
      setState('ready');
    })().catch(() => setState('ready'));
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const move = (key: GuideKey, deltaPx: number) => {
    setUserMoved(true);
    setGuides((g) => {
      const next = { ...g, [key]: g[key] + deltaPx };
      // Keep a sane ordering: outer outside inner, minimum 2px border.
      next.outL = Math.min(Math.max(0, next.outL), next.inL - 2);
      next.inL = Math.min(Math.max(next.outL + 2, next.inL), next.inR - 10);
      next.inR = Math.min(Math.max(next.inL + 10, next.inR), next.outR - 2);
      next.outR = Math.min(Math.max(next.inR + 2, next.outR), BUF_W);
      next.outT = Math.min(Math.max(0, next.outT), next.inT - 2);
      next.inT = Math.min(Math.max(next.outT + 2, next.inT), next.inB - 10);
      next.inB = Math.min(Math.max(next.inT + 10, next.inB), next.outB - 2);
      next.outB = Math.min(Math.max(next.inB + 2, next.outB), BUF_H);
      return next;
    });
  };

  const scaleFromDisplay = () => {
    const el = stageRef.current;
    if (!el) return 1;
    return BUF_W / el.clientWidth;
  };

  const onPointerDown = (key: GuideKey) => (e: React.PointerEvent) => {
    dragRef.current = { key, lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const scale = scaleFromDisplay();
    const movement = VERTICAL.includes(d.key) ? e.clientX - d.lastX : e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    if (movement !== 0) move(d.key, movement * scale);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const borders = {
    left: guides.inL - guides.outL,
    right: guides.outR - guides.inR,
    top: guides.inT - guides.outT,
    bottom: guides.outB - guides.inB,
  };
  const ratios = useMemo(
    () => ({
      leftRight: axisRatio(borders.left, borders.right),
      topBottom: axisRatio(borders.top, borders.bottom),
    }),
    [borders.left, borders.right, borders.top, borders.bottom],
  );
  const score = face === 'front' ? scoreFrontCentering(ratios) : scoreBackCentering(ratios);
  const cardWpx = guides.outR - guides.outL;
  const cardHpx = guides.outB - guides.outT;
  const mm = (px: number, horizontal: boolean) =>
    ((px / (horizontal ? cardWpx : cardHpx)) * (horizontal ? CARD_MM_W : CARD_MM_H)).toFixed(1);

  const method: CenteringMethod = borderless
    ? 'design_element'
    : autoDetected && bordersDetected && !userMoved
      ? 'border_detect'
      : 'manual';

  return (
    <section className="centering panel" aria-label={`${face} centering`}>
      <div className="centering-head">
        <h2 className="mono-label">
          {face === 'front' ? 'Front centering' : 'Back centering'}
        </h2>
        <label className="centering-borderless">
          <input
            type="checkbox"
            checked={borderless}
            onChange={(e) => setBorderless(e.target.checked)}
          />
          Borderless / full-art card
        </label>
      </div>

      <p className="centering-hint">
        {borderless
          ? 'No printed border to measure. Set the inner guides on a consistent design element — a name plate, a logo, a frame line — the same one on opposite sides. This is a proxy, so the result carries one step less confidence.'
          : autoDetected && bordersDetected
            ? 'Guides sit where the border was detected. Drag any line — or nudge with arrow keys — until each one sits exactly on the border/artwork transition.'
            : 'Automatic detection didn’t lock on. Drag the outer guides to the card’s edges and the inner guides to the border transition.'}
      </p>

      <div
        ref={stageRef}
        className="centering-stage"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="centering-canvas" width={BUF_W} height={BUF_H} />
        {state === 'ready' &&
          (Object.keys(guides) as GuideKey[]).map((key) => {
            const vertical = VERTICAL.includes(key);
            const pos = guides[key] / (vertical ? BUF_W : BUF_H);
            const outer = key.startsWith('out');
            return (
              <div
                key={key}
                role="slider"
                tabIndex={0}
                aria-label={GUIDE_LABELS[key]}
                aria-valuenow={Math.round(guides[key])}
                aria-valuemin={0}
                aria-valuemax={vertical ? BUF_W : BUF_H}
                className={`centering-guide ${vertical ? 'is-v' : 'is-h'} ${outer ? 'is-outer' : 'is-inner'}`}
                style={vertical ? { left: `${pos * 100}%` } : { top: `${pos * 100}%` }}
                onPointerDown={onPointerDown(key)}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 5 : 1;
                  if (vertical && e.key === 'ArrowLeft') move(key, -step);
                  else if (vertical && e.key === 'ArrowRight') move(key, step);
                  else if (!vertical && e.key === 'ArrowUp') move(key, -step);
                  else if (!vertical && e.key === 'ArrowDown') move(key, step);
                  else return;
                  e.preventDefault();
                }}
              />
            );
          })}
        {state === 'loading' && <div className="mono-label centering-loading">Measuring…</div>}
      </div>

      <div className="centering-readout">
        <div className="centering-ratio">
          <span className="mono-label">Left / Right</span>
          <strong className="mono-value">
            {ratios.leftRight[0].toFixed(1)} / {ratios.leftRight[1].toFixed(1)}
          </strong>
          <span className="centering-mm mono-label">
            {mm(borders.left, true)}mm · {mm(borders.right, true)}mm
          </span>
        </div>
        <div className="centering-ratio">
          <span className="mono-label">Top / Bottom</span>
          <strong className="mono-value">
            {ratios.topBottom[0].toFixed(1)} / {ratios.topBottom[1].toFixed(1)}
          </strong>
          <span className="centering-mm mono-label">
            {mm(borders.top, false)}mm · {mm(borders.bottom, false)}mm
          </span>
        </div>
        <div className="centering-ratio centering-score">
          <span className="mono-label">Centering sub-score</span>
          <strong className="display centering-score-num">{score}</strong>
          <span className="centering-mm mono-label">worse axis {worseAxis(ratios).toFixed(1)}</span>
        </div>
      </div>

      <div className="centering-actions">
        <button type="button" className="btn-outline" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="btn-acid"
          disabled={state !== 'ready'}
          onClick={() => onDone({ ratios, method, score, borders })}
        >
          {face === 'front' ? 'Use these numbers → back of card' : 'Use these numbers →'}
        </button>
      </div>
    </section>
  );
}
