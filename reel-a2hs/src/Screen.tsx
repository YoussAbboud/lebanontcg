// The phone "screen": the real 390-px mobile page scaled into a rounded 800×1421 window on the stage (no bezel).
// Everything inside is laid out in screen-local px; `L` converts the capture's CSS px (src/layout.json) to local px.
import React from 'react';
import { Img, staticFile } from 'remotion';
import layout from './layout.json';
import { C } from './theme';

export const SCREEN = { x: 140, y: 400, w: 800, h: 1421, r: 50 };
export const S = SCREEN.w / layout.vw; // 2.0513 local px per CSS px
export const L = (v: number) => v * S;
export type Rect = { x: number; y: number; w: number; h: number };
export const rectL = (r: Rect): Rect => ({ x: L(r.x), y: L(r.y), w: L(r.w), h: L(r.h) });
export const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const IOS = layout.sheetIos;
export const ANDROID = layout.sheetAndroid;

/** The rounded window. `fade` dissolves its contents (and the window itself) into the stage. */
export const Screen: React.FC<{ children?: React.ReactNode; fade?: number; style?: React.CSSProperties }> = ({ children, fade = 0, style }) => (
  <div
    style={{
      position: 'absolute', left: SCREEN.x, top: SCREEN.y, width: SCREEN.w, height: SCREEN.h, borderRadius: SCREEN.r, overflow: 'hidden',
      background: '#08090b', opacity: 1 - fade,
      boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 40px 90px -30px rgba(0,0,0,0.7), 0 12px 30px rgba(0,0,0,0.35)',
      ...style,
    }}
  >
    {children}
  </div>
);

/** The home page's first screen (a 3× capture; sheet suppressed). */
export const HomePage: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <Img src={staticFile('textures/home-3x.png')} style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.w, height: SCREEN.h, ...style }} />
);

/** The site's own backdrop behind the sheet (var(--overlay) = rgba(8,9,11,0.78)). */
export const Overlay: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div style={{ position: 'absolute', inset: 0, background: `rgba(8,9,11,${(0.78 * opacity).toFixed(3)})` }} />
);

/** A sheet cutout (4× capture) at its captured place, translated by `dy` local px; the top corners are re-rounded so
    the capture's corner pixels never show while it moves. */
export const Sheet: React.FC<{ variant: 'ios' | 'android'; dy?: number; opacity?: number }> = ({ variant, dy = 0, opacity = 1 }) => {
  const box = rectL(variant === 'ios' ? IOS.box : ANDROID.box);
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, transform: `translateY(${dy.toFixed(2)}px)`, opacity, borderRadius: `${L(20)}px ${L(20)}px 0 0`, overflow: 'hidden' }}>
      <Img src={staticFile(`textures/sheet-${variant}-4x.png`)} style={{ position: 'absolute', left: 0, top: 0, width: box.w, height: box.h }} />
    </div>
  );
};

/** A rectangle of a sheet capture as its own element (so a real step card can lift off the sheet). */
export const SheetPatch: React.FC<{ variant: 'ios' | 'android'; rect: Rect; style?: React.CSSProperties; children?: React.ReactNode }> = ({ variant, rect, style, children }) => {
  const box = rectL(variant === 'ios' ? IOS.box : ANDROID.box);
  const r = rectL(rect);
  return (
    <div
      style={{
        position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, overflow: 'hidden',
        backgroundImage: `url(${staticFile(`textures/sheet-${variant}-4x.png`)})`, backgroundSize: `${box.w}px ${box.h}px`,
        backgroundPosition: `${(box.x - r.x).toFixed(2)}px ${(box.y - r.y).toFixed(2)}px`, ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A fingertip tap: a dark-rimmed accent ring that blooms and fades over 16 f from `at`. */
export const TapRing: React.FC<{ x: number; y: number; at: number; frame: number; color?: string; rim?: string }> = ({ x, y, at, frame, color = C.accent, rim = 'rgba(8,9,11,0.7)' }) => {
  const t = (frame - at) / 16;
  if (t < 0 || t > 1) return null;
  const e = 1 - Math.pow(1 - t, 3);
  const r = 22 + 70 * e;
  return (
    <div
      style={{
        position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', boxSizing: 'border-box',
        border: `${(5 - 3.5 * e).toFixed(2)}px solid ${color}`, boxShadow: `0 0 0 2px ${rim}, inset 0 0 0 2px ${rim}`,
        opacity: 1 - Math.pow(t, 1.6),
      }}
    />
  );
};
