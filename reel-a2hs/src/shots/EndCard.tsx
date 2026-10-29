// S7 · End — outro/logo-shrink-wordmark-lockup, adapted: the app view fades to the stage; the icon (5.4× → 1×,
// in-out cubic, fading in over its first 8 f as the app view leaves) brakes with a +6 % overshoot on b37.5 (one shockwave ring, two scale ghosts only while fast), shifts
// left to make room, the wordmark letters slide in with a focus blur (dot last), the tagline fades in as a whole line,
// and the URL closes. The icon never rotates. Holds ≥1 s.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { E, lerp, seg } from '../fixtures/Motion';
import { C, FONT } from '../theme';
import { HomePage, Screen } from '../Screen';
import { AppIcon } from './HomeScreen';
import { SHOTS, localBeat } from '../timing';

export const END_DEFAULTS = { wordmark: 'LEBANONTCG.', tagline: 'NOW ON YOUR HOME SCREEN', url: 'www.lebanontcg.com', wordSize: 76, tagSize: 34, urlSize: 44 };

const ICON = 150; // lockup icon size
const GAP = 30;
const WORD_W = 520; // measured on a render still (adjust if the wordmark size changes)
const SHIFT = -(ICON + GAP + WORD_W) / 2 + ICON / 2;
const ROW_LEFT = SHIFT + ICON / 2 + GAP;
const CY = 960; // lockup centre line
export const LAND = localBeat(SHOTS.end, 37.5); // 22
export const LETTERS0 = LAND + 18; // 40: the wordmark starts
export const TAG0 = LETTERS0 + 18; // 58
export const URL0 = TAG0 + 6; // 64

const scaleAt = (f: number) => {
  const k = seg(f, 0, LAND, E.inOutCubic);
  const brake = Math.sin(seg(f, LAND, LAND + 8) * Math.PI) * 0.06;
  return lerp(k, 5.4, 1) * (1 + brake);
};

export const EndCard: React.FC<Partial<typeof END_DEFAULTS>> = (props) => {
  const { wordmark, tagline, url, wordSize, tagSize, urlSize } = { ...END_DEFAULTS, ...props };
  const f = useCurrentFrame();
  const fade = seg(f, 0, 12, E.outQuad);
  const enter = seg(f, 0, 8, E.outQuad);
  const s = scaleAt(f);
  const shift = seg(f, LAND + 6, LAND + 18, E.inOutCubic) * SHIFT;
  const ds = Math.abs(scaleAt(f) - scaleAt(f - 1));
  const trail = Math.min(1, ds / 0.35);
  const wave = seg(f, LAND, LAND + 18, E.outCubic);
  const haloR = lerp(seg(f, 0, LAND + 2, E.inOutCubic), 520, 130);
  const haloA = 0.35 - 0.22 * seg(f, LAND + 2, LAND + 20, E.outCubic);
  const letters = [...wordmark];
  const L0 = LETTERS0;
  const STAG = 2;
  const tagT = seg(f, TAG0, TAG0 + 12, E.outQuad);
  const urlT = seg(f, URL0, URL0 + 12, E.outCubic);

  const icon = (sc: number, opacity: number) => (
    <div style={{ position: 'absolute', left: 540 - ICON / 2, top: CY - ICON / 2, width: ICON, height: ICON, transform: `translateX(${shift.toFixed(2)}px) scale(${sc.toFixed(4)})`, opacity }}>
      <AppIcon size={ICON} style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 30px 60px -20px rgba(0,0,0,0.7)` }} />
    </div>
  );

  return (
    <>
      {/* the app view leaves */}
      {fade < 1 && (
        <Screen fade={fade}>
          <HomePage />
        </Screen>
      )}
      {/* halo that collapses with the icon */}
      <div style={{ position: 'absolute', left: 540 + shift - haloR, top: CY - haloR, width: haloR * 2, height: haloR * 2, borderRadius: '50%', opacity: haloA * Math.min(1, f / 6), background: `radial-gradient(circle, rgba(211,252,59,0.26) 0%, rgba(211,252,59,0.08) 40%, rgba(211,252,59,0) 70%)` }} />
      {/* one shockwave on the brake */}
      {wave > 0 && wave < 1 && (
        <div style={{ position: 'absolute', left: 540 - lerp(wave, 90, 330), top: CY - lerp(wave, 90, 330), width: lerp(wave, 180, 660), height: lerp(wave, 180, 660), borderRadius: '50%', boxSizing: 'border-box', border: `${lerp(wave, 3, 1).toFixed(2)}px solid rgba(211,252,59,${(0.55 * (1 - wave)).toFixed(3)})`, boxShadow: `0 0 ${lerp(wave, 8, 20)}px rgba(211,252,59,${(0.35 * (1 - wave)).toFixed(3)})` }} />
      )}
      {trail > 0.02 && f > 2 && icon(scaleAt(f - 2), 0.16 * trail * enter)}
      {trail > 0.02 && f > 1 && icon(scaleAt(f - 1), 0.3 * trail * enter)}
      {icon(s, enter)}
      {/* wordmark letters, staggered, with a focus blur; the dot is the last to land */}
      <div style={{ position: 'absolute', left: 540 + ROW_LEFT, top: CY - wordSize * 0.55, height: wordSize * 1.1, display: 'flex', alignItems: 'center' }}>
        {letters.map((ch, i) => {
          const lk = seg(f, L0 + i * STAG, L0 + i * STAG + 10, E.outCubic);
          return (
            <span key={i} style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: wordSize, lineHeight: 1, letterSpacing: '0.02em', color: ch === '.' ? C.accent : C.ink, whiteSpace: 'pre', opacity: lk, transform: `translateX(${lerp(lk, 10, 0).toFixed(2)}px)`, filter: lk < 0.999 ? `blur(${lerp(lk, 3, 0).toFixed(2)}px)` : undefined }}>
              {ch}
            </span>
          );
        })}
      </div>
      {/* tagline (whole line) and URL */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: CY + 118, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 500, fontSize: tagSize, letterSpacing: '0.2em', color: C.accent, opacity: tagT, transform: `translateY(${lerp(tagT, 6, 0).toFixed(2)}px)` }}>
        {tagline}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: CY + 186, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: urlSize, letterSpacing: '0.02em', color: C.ink, opacity: urlT, transform: `translateY(${lerp(urlT, 10, 0).toFixed(2)}px)` }}>
        {url}
      </div>
    </>
  );
};
