// S5 · Home — the page and sheet dissolve to a drawn phone home screen (non-replica UI, drawn from the site's tokens)
// while the real icon lifts out of the sheet's tile and travels on an arc into an empty grid slot (a real slot, Q9),
// landing on b28.5 with a small overshoot; the label settles under it. The icon is the one object carried across.
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { ANDROID, HomePage, Overlay, Rect, SCREEN, Screen, Sheet, centre, rectL } from '../Screen';
import { SHOTS, localBeat } from '../timing';
import { C, FONT } from '../theme';
import { EASE, mix, ramp, softShadow } from '../fixtures/Polish';
import { PUSH, stepsCentre } from './Steps';

// ---- the drawn home screen (screen-local px) -------------------------------------------------
export const TILE = 140;
export const COLS = 4;
const GX = 48;
const GAP = (SCREEN.w - 2 * GX - COLS * TILE) / (COLS - 1);
const GY = 180;
const PITCH = 222;
export const ROWS = 4;
export const SLOT = { r: 1, c: 2 }; // the empty slot the icon lands in
export const slotRect = (r: number, c: number): Rect => ({ x: GX + c * (TILE + GAP), y: GY + r * PITCH, w: TILE, h: TILE });
export const ICON_RECT = slotRect(SLOT.r, SLOT.c);
export const ICON_R = 32;
const DOCK = { y: SCREEN.h - 200, h: 176 };

export const HomeWall: React.FC<{ opacity?: number; showIcon?: boolean; iconScale?: number; label?: number; children?: React.ReactNode }> = ({ opacity = 1, showIcon, iconScale = 1, label = 1, children }) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>
    {/* wallpaper: the site's ground with its floor glow */}
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(58% 42% at 50% 62%, rgba(214,255,63,0.10), rgba(214,255,63,0) 70%), linear-gradient(180deg, #0c0e12 0%, #08090b 60%, #0a0b0f 100%)` }} />
    {/* status bar */}
    <div style={{ position: 'absolute', left: 54, right: 54, top: 34, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: FONT.sans, fontWeight: 600, fontSize: 32, color: '#f2f5f7' }}>
      <span>10:52</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>{[10, 15, 20, 25].map((h, i) => <span key={i} style={{ width: 6, height: h, borderRadius: 2, background: '#f2f5f7' }} />)}</span>
        <span style={{ width: 54, height: 26, borderRadius: 8, border: '2.5px solid rgba(242,245,247,0.6)', boxSizing: 'border-box', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 3, top: 3, bottom: 3, width: 28, borderRadius: 4, background: '#f2f5f7' }} />
        </span>
      </span>
    </div>
    {/* neutral app tiles (no third-party branding): rounded surfaces with a soft top light and a label bar */}
    {Array.from({ length: ROWS * COLS }, (_, i) => {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      if (r === SLOT.r && c === SLOT.c) return null;
      const q = slotRect(r, c);
      const hue = (i * 47) % 360;
      return (
        <div key={i} style={{ position: 'absolute', left: q.x, top: q.y, width: TILE, height: TILE }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: ICON_R, background: `linear-gradient(160deg, hsl(${hue} 10% 20%) 0%, hsl(${hue} 8% 13%) 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px -8px rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'absolute', left: 36, right: 36, top: 60, height: 20, borderRadius: 10, background: `hsl(${hue} 12% 30%)`, opacity: 0.55 }} />
          <div style={{ position: 'absolute', left: TILE / 2 - 40, top: TILE + 14, width: 80, height: 14, borderRadius: 7, background: 'rgba(242,245,247,0.22)' }} />
        </div>
      );
    })}
    {/* dock */}
    <div style={{ position: 'absolute', left: 40, right: 40, top: DOCK.y, height: DOCK.h, borderRadius: 44, background: 'rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: 'absolute', left: 40 + i * (TILE + 40), top: (DOCK.h - TILE) / 2, width: TILE, height: TILE, borderRadius: ICON_R, background: `linear-gradient(160deg, hsl(${(i * 83 + 20) % 360} 10% 22%) 0%, hsl(${(i * 83 + 20) % 360} 8% 14%) 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }} />
      ))}
    </div>
    {/* the LebanonTCG icon in its slot (when it has landed) + label */}
    {showIcon && (
      <>
        <div style={{ position: 'absolute', left: ICON_RECT.x, top: ICON_RECT.y, width: TILE, height: TILE, transform: `scale(${iconScale.toFixed(4)})` }}>
          <AppIcon size={TILE} />
        </div>
        <div style={{ position: 'absolute', left: ICON_RECT.x - 60, width: TILE + 120, top: ICON_RECT.y + TILE + 10, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 500, fontSize: 32, color: '#f2f5f7', opacity: label, letterSpacing: '0.005em' }}>
          LebanonTCG
        </div>
      </>
    )}
    {children}
  </div>
);

export const AppIcon: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile('icon-512.png')} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size * (ICON_R / TILE), boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', ...style }} />
);

export const LAND = localBeat(SHOTS.home, 28.5); // 36
const DISSOLVE = 12;

export const HomeScreen: React.FC = () => {
  const f = useCurrentFrame();
  const x = ramp(f, 0, DISSOLVE, EASE.smooth);
  const o = stepsCentre();
  // the sheet's tile, in local px, as it sits under the S4 camera (push 1.12 about the steps' centre)
  const tile = rectL(ANDROID.tile);
  const tc = centre(tile);
  const from = { x: o.x + (tc.x - o.x) * PUSH, y: o.y + (tc.y - o.y) * PUSH, s: tile.w * PUSH };
  const to = { x: ICON_RECT.x + TILE / 2, y: ICON_RECT.y + TILE / 2, s: TILE };
  const p = ramp(f, 0, LAND, EASE.swift);
  const arc = Math.sin(Math.PI * p) * 140;
  const cx = mix(from.x, to.x, p);
  const cy = mix(from.y, to.y, p) - arc;
  const size = mix(from.s, to.s, p);
  const landed = f >= LAND;
  // landing: a 10 f settle with a 6% overshoot, then the label fades in
  const bump = landed ? 1 + 0.06 * Math.sin(Math.PI * Math.min(1, (f - LAND) / 10)) : 1;
  const label = ramp(f, LAND + 6, 10, EASE.out);
  const elev = 48 * Math.sin(Math.PI * p);
  return (
    <Screen bar={1 - x}>
      {/* outgoing: the page under the Android sheet, still under the S4 camera */}
      {x < 1 && (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - x, transform: `scale(${PUSH})`, transformOrigin: `${o.x.toFixed(1)}px ${o.y.toFixed(1)}px` }}>
          <HomePage />
          <Overlay opacity={1} />
          <Sheet variant="android" />
          {/* the tile's place is empty from the first frame: the flying icon IS the tile's icon (one object) */}
          <div style={{ position: 'absolute', left: tile.x, top: tile.y, width: tile.w, height: tile.h, borderRadius: 15 * 2.05, background: '#16191e' }} />
        </div>
      )}
      <HomeWall opacity={x} showIcon={landed} iconScale={bump} label={label} />
      {/* the icon in flight (one object, carried across the dissolve) */}
      {!landed && (
        <div style={{ position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size, borderRadius: size * (ICON_R / TILE), boxShadow: softShadow(elev, { color: '#000000', strength: 2.2 }) }}>
          <AppIcon size={size} />
        </div>
      )}
      {/* accent flash on the landing (one light, clipped to the icon's corners) */}
      {landed && f < LAND + 10 && (
        <div style={{ position: 'absolute', left: ICON_RECT.x, top: ICON_RECT.y, width: TILE, height: TILE, borderRadius: ICON_R, boxShadow: `0 0 0 ${(3 * (1 - (f - LAND) / 10)).toFixed(1)}px ${C.accent}`, opacity: 1 - (f - LAND) / 10 }} />
      )}
    </Screen>
  );
};
