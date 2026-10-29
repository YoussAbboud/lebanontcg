// S6 · Launch — a fingertip taps the icon (press squash), and it opens as a window (transition/shot-transitions C,
// portal-wipe): the icon's rect grows to the screen over 34 f on bezier(0.7,0,0.3,1); the real page grows inside from
// 0.66 → 1 with the same t (the window and its contents share one progress); the icon face fades within the first
// 45 % of the travel. Then a true hold (≥30 f) on the app view — the site with no browser bar (S1–S4 had one).
import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { HomePage, SCREEN, Screen, TapRing } from '../Screen';
import { EASE, mix, ramp, softShadow } from '../fixtures/Polish';
import { AppIcon, HomeWall, ICON_R, ICON_RECT, TILE } from './HomeScreen';

export const TAP = 4;
export const WIN0 = 8;
export const WIN1 = 42;

export const Launch: React.FC = () => {
  const f = useCurrentFrame();
  const press = f >= TAP && f < TAP + 4 ? 0.94 : f >= TAP + 4 ? 0.94 + 0.06 * ramp(f, TAP + 4, 6, EASE.out) : 1;
  const t = interpolate(f, [WIN0, WIN1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const x = mix(ICON_RECT.x, 0, t);
  const y = mix(ICON_RECT.y, 0, t);
  const w = mix(TILE, SCREEN.w, t);
  const h = mix(TILE, SCREEN.h, t);
  const r = mix(ICON_R, 0, t);
  const inner = mix(0.66, 1, t);
  const dimHome = 0.5 * ramp(f, WIN0, 24, EASE.out);
  const elev = 56 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - t);
  return (
    <Screen>
      <HomeWall showIcon={t === 0} iconScale={press} />
      {t > 0 && t < 1 && <div style={{ position: 'absolute', inset: 0, background: `rgba(8,9,11,${dimHome.toFixed(3)})` }} />}
      {/* the window: the icon's rect growing into the app view */}
      {f >= WIN0 && (
        <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, overflow: 'hidden', boxShadow: t < 1 ? softShadow(elev, { color: '#000000', strength: 2 }) : 'none' }}>
          <div style={{ position: 'absolute', width: SCREEN.w, height: SCREEN.h, left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${inner.toFixed(4)})` }}>
            <HomePage />
          </div>
          {t < 0.46 && (
            <div style={{ position: 'absolute', left: 0, top: 0, width: TILE, height: TILE, transform: `scale(${(w / TILE).toFixed(4)}, ${(h / TILE).toFixed(4)})`, transformOrigin: '0 0', opacity: Math.max(0, 1 - t * 2.2) }}>
              <AppIcon size={TILE} />
            </div>
          )}
        </div>
      )}
      <TapRing x={ICON_RECT.x + TILE / 2} y={ICON_RECT.y + TILE / 2} at={TAP} frame={f} />
    </Screen>
  );
};
