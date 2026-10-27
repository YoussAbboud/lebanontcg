// S1 · Opening — card-flock-tumble (tumble + idle only) → shot-transitions C (portal wipe) into the real Browse page.
// Adapted from demos/transition/card-flock-tumble/CardFlockTumble.tsx and demos/transition/shot-transitions/PortalWipeV2.tsx.
//
// Kept from card-flock-tumble: three cards fly from an edge-on k0 (ry ≈ 90°) through k1 to a staircase k2 on ONE
// Catmull-Rom spline (split at 0.55) driven by Easing.out(cubic) over 44f; zero blur; after landing they keep drifting
// (ry/rx/rz per frame, squared 14f ease-in) — never a still frame; back cards darkened a step for depth; perspective 1400.
// Not used (brief bans glows/decoration): backdrop word wall, aurora light, collapse, core flash, smoke ring, giant type.
// Re-posed for 9:16: the staircase spreads vertically (y ±200) and is ~1.22× the demo's scale (the front card fills ~2/3
// of the frame width) so each card's game and art reads; the cards are the
// site's real listing cards (4× captures), one per game, Venusaur in front.
//
// Kept from the portal wipe (C): the target hovers first (−10px · 1.03× while neighbours dim), then the window grows over
// 40f with bezier(0.7,0,0.3,1); the world inside grows 0.42→1 on the SAME t; the card face fades out by t≈0.28
// (opacity 1 − 3.6t); one layer inside (the page), no blur. The world here is the real Browse page — where this card is
// the first listing — so the portal lands on the exact first frame of S2 (drop, b8).
//
// Timeline (local = absolute; 0–119):
//   1–45    flight (lands b3)        45–119  idle drift (back cards)
//   63–79   front card turns flat, centres and lifts (hover)
//   79–119  portal: window card-rect → full frame, Browse page inside, done on b8 (the drop)
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, mix, ramp } from '../fixtures/Polish';
import layout from '../layout.json';
import { C } from '../theme';
import { H, W } from '../timing';

const FLIGHT = [1, 45] as const;
const HOVER = [63, 79] as const;
const PORTAL = [79, 119] as const;
const K = 1.07; // card base size = CSS size × K (pose scale s then sizes it on screen; 4× texture stays sharp)
const PAGE_S = W / layout.vw; // 2.769: the mobile page fills the frame width

type Pose = { x: number; y: number; rx: number; ry: number; rz: number; s: number };
const KEYS: (keyof Pose)[] = ['x', 'y', 'rx', 'ry', 'rz', 's'];
const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
const splinePose = (k: Pose[], u: number): Pose => {
  const seg = u < 0.55 ? 0 : 1;
  const lt = seg === 0 ? u / 0.55 : (u - 0.55) / 0.45;
  const o = {} as Pose;
  for (const key of KEYS) o[key] = catmull(k[Math.max(0, seg - 1)][key], k[seg][key], k[seg + 1][key], k[Math.min(2, seg + 2)][key], lt);
  return o;
};
const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  const o = {} as Pose;
  for (const key of KEYS) o[key] = a[key] + (b[key] - a[key]) * t;
  return o;
};

// back → front: Ragavan (Magic), Red-Eyes B. Dragon (Yu-Gi-Oh!), Venusaur (Pokémon)
const ORDER = [2, 1, 0]; // indices into layout.opening (captured as Venusaur, Red-Eyes, Ragavan)
const POSES: [Pose, Pose, Pose][] = [
  [
    { x: -10, y: -24, rx: 9, ry: 88, rz: 12, s: 1.28 },
    { x: -175, y: -270, rx: 16, ry: 44, rz: -8, s: 1.59 },
    { x: -150, y: -225, rx: 4, ry: 13, rz: -2, s: 1.83 },
  ],
  [
    { x: 0, y: 0, rx: 8, ry: 89, rz: 12, s: 1.22 },
    { x: -30, y: -50, rx: 13, ry: 38, rz: -7, s: 1.66 },
    { x: -20, y: -35, rx: 3, ry: 11, rz: -2, s: 1.93 },
  ],
  [
    { x: 10, y: 24, rx: 7, ry: 90, rz: 12, s: 1.16 },
    { x: 140, y: 205, rx: 11, ry: 34, rz: -6, s: 1.73 },
    { x: 120, y: 170, rx: 2, ry: 9, rz: -1, s: 2.03 },
  ],
];
// the front card's flat, centred hover pose (the portal opens from here)
const HOVER_POSE: Pose = { x: 0, y: -10, rx: 0, ry: 0, rz: 0, s: 1.9 * 1.03 };

// idle drift after landing (the demo's rates, slowed to 0.25°/f for this longer 70f hold; never stops)
const idleAt = (f: number) => {
  const t = f - FLIGHT[1] * 0.86;
  if (t <= 0) return { ry: 0, rx: 0, rz: 0 };
  const r = Math.min(1, t / 14) ** 2;
  return { ry: t * 0.25 * r, rx: t * -0.08 * r, rz: t * 0.04 * r };
};

const poseAt = (i: number, f: number): Pose => {
  const k = POSES[i];
  const raw = Math.min(1, Math.max(0, (f - FLIGHT[0]) / (FLIGHT[1] - FLIGHT[0])));
  const p = splinePose(k, Easing.out(Easing.cubic)(raw));
  const d = idleAt(f);
  return { ...p, ry: p.ry + d.ry, rx: p.rx + d.rx, rz: p.rz + d.rz };
};

const Card: React.FC<{ n: number; dark: number; radius: number }> = ({ n, dark, radius }) => {
  const c = layout.opening[n];
  return (
    <div style={{ position: 'relative', width: c.w * K, height: c.h * K, borderRadius: radius, boxShadow: `0 40px 80px -20px rgba(0,0,0,0.55), 0 10px 26px ${C.shadow}` }}>
      <Img src={staticFile(`textures/${c.file}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: radius }} />
      {dark > 0 && <div style={{ position: 'absolute', inset: 0, borderRadius: radius, background: '#15181d', opacity: dark }} />}
    </div>
  );
};

// the Browse page's first screen, at frame scale (identical to S2's first frame)
export const BrowseTop: React.FC = () => (
  <Img src={staticFile('textures/browse-top-3x.png')} style={{ position: 'absolute', left: 0, top: 0, width: W, height: layout.browse.tiles.top.h * PAGE_S }} />
);

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const hover = ramp(frame, HOVER[0], HOVER[1] - HOVER[0], EASE.smooth);
  const t = interpolate(frame, [PORTAL[0], PORTAL[1]], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const neighbours = 0.2 * hover + 0.26 * ramp(frame, PORTAL[0], 34, EASE.out); // dim the back cards as the portal opens

  // the front card's hovered rect on screen (the portal's start rect)
  const front = layout.opening[ORDER[2]];
  const fw = front.w * K * HOVER_POSE.s;
  const fh = front.h * K * HOVER_POSE.s;
  const c0 = { x: W / 2 - fw / 2, y: H / 2 - fh / 2 - 10, w: fw, h: fh, r: 18 * K * HOVER_POSE.s };
  const win = { x: mix(c0.x, 0, t), y: mix(c0.y, 0, t), w: mix(c0.w, W, t), h: mix(c0.h, H, t), r: mix(c0.r, 0, t) };
  const innerScale = mix(0.42, 1, t);

  return (
    <AbsoluteFill style={{ background: C.stage, overflow: 'hidden' }}>
      {/* the card stack (zero blur, never still) */}
      <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: '50% 50%' }}>
        {[0, 1, 2].map((i) => {
          const isFront = i === 2;
          if (isFront && frame >= PORTAL[0]) return null; // the portal window takes over the front card
          let p = poseAt(i, frame);
          if (isFront && hover > 0) p = lerpPose(p, HOVER_POSE, hover);
          const dark = i === 0 ? 0.24 : i === 1 ? 0.12 : 0;
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%', zIndex: 10 + i,
              transform: `translate(-50%, -50%) translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) rotateX(${p.rx.toFixed(3)}deg) rotateY(${p.ry.toFixed(3)}deg) rotateZ(${p.rz.toFixed(3)}deg) scale(${p.s.toFixed(4)})`,
            }}>
              <Card n={ORDER[i]} dark={isFront ? 0 : Math.min(0.6, dark + neighbours)} radius={18 * K} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* portal: the front card is the window; the real Browse page grows inside it */}
      {frame >= PORTAL[0] && (
        <div style={{
          position: 'absolute', left: win.x, top: win.y, width: win.w, height: win.h, borderRadius: win.r, overflow: 'hidden', zIndex: 30,
          boxShadow: t < 1 ? `0 ${(40 * (1 - t)).toFixed(1)}px ${(90 * (1 - t)).toFixed(1)}px rgba(0,0,0,${(0.55 * (1 - t)).toFixed(3)})` : 'none',
        }}>
          <div style={{
            position: 'absolute', width: W, height: H, left: '50%', top: '50%', overflow: 'hidden', background: '#0b0c10',
            transform: `translate(-50%, -50%) scale(${innerScale.toFixed(4)})`,
          }}>
            <BrowseTop />
          </div>
          {t < 0.3 && (
            <div style={{ position: 'absolute', inset: 0, opacity: Math.max(0, 1 - t * 3.6) }}>
              <Img src={staticFile(`textures/${front.file}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
