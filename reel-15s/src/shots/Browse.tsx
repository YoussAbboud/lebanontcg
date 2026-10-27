// S2 · Browse — scroll-brake-moves A (changelog-scroll-brake) on the real mobile Browse page, then tap → open.
// Adapted from demos/data/scroll-brake-moves/ChangelogScrollBrake.tsx.
//
// Kept: 50f scroll on cubic-bezier(0.45,0,0.06,1) (~5f to full speed, long exponential tail); vertical SpeedBlur driven by
// the frame-to-frame displacement (amount 0.32, max 30px, auto-clears when stopped); the stop row lifts 14f EASE.out to
// 1.03× with a deeper shadow and a 2px accent outline while the rest dims to 0.38; the target stops at frame centre.
// The demo's fake changelog rows are replaced by the real Browse feed (42 real-layout listings); the stop is the live
// Umbreon auction (b13 = abs 192). Blurred frames show the 1× base; every frame you can read is a 3× capture.
// Then: a tap (press 0.985 + one thin ring) on b14, and the card's art grows into the listing page's photo — a
// shared-element open (220–251), landing exactly on S3's first frame (b17).
//
// Local timeline (abs = local + 119):  0–23 hold on the page top · 23–73 scroll + brake · 73–87 lift ·
//   88 tap (b14) · 102–132 shared-element open (art → listing photo), listing page fades in under it
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, SpeedBlur, bezier, mix, ramp } from '../fixtures/Polish';
import layout from '../layout.json';
import { C } from '../theme';
import { BrowsePage, ListingPage, PAGE_S, VH, rectOnScreen } from './Page';

const SCROLL0 = 23;
const SCROLL1 = 73;
const LIFT0 = 73;
const TAP = 88;
const OPEN = [102, 132] as const;

const target = layout.browse.cards[layout.browse.target];
const END_SCROLL = target.y + target.h / 2 - VH / 2; // target card centred in frame
const BRAKE = bezier(0.45, 0, 0.06, 1);
const scrollAt = (f: number) => interpolate(f, [SCROLL0, SCROLL1], [0, END_SCROLL], { easing: BRAKE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const Browse: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = scrollAt(frame);
  const v = (scrollAt(frame + 0.5) - scrollAt(frame - 0.5)) * PAGE_S; // screen px / frame
  const lift = interpolate(frame, [LIFT0, LIFT0 + 14], [0, 1], { easing: EASE.out, ...CL });
  const press = interpolate(frame, [TAP, TAP + 3, TAP + 9], [1, 0.985, 1], CL);
  const ring = ramp(frame, TAP, 12, EASE.out);
  const open = interpolate(frame, [OPEN[0], OPEN[1]], [0, 1], { easing: Easing.bezier(0.7, 0, 0.3, 1), ...CL });
  const pageOut = ramp(frame, OPEN[0], 24, EASE.smooth);

  const card = rectOnScreen(target, scroll);
  const s = 1 + 0.03 * lift;
  // shared element: browse card art → listing photo (S3 starts at scroll 0)
  const from = rectOnScreen(target.face, scroll);
  const to = rectOnScreen(layout.listing.face, 0);
  const r = { x: mix(from.x, to.x, open), y: mix(from.y, to.y, open), w: mix(from.w, to.w, open), h: mix(from.h, to.h, open) };
  // the art rect also rides the lifted card's scale until it takes off
  const sc = open > 0 ? 1 : s * press;
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
  const art = open > 0 ? r : { x: cx + (from.x - cx) * sc, y: cy + (from.y - cy) * sc, w: from.w * sc, h: from.h * sc };
  const tapAt = { x: art.x + art.w * 0.5, y: art.y + art.h * 0.55 };

  return (
    <AbsoluteFill style={{ background: '#0b0c10' }}>
      {/* the listing page arrives underneath as the browse page leaves */}
      {open > 0 && <ListingPage scroll={0} hideFace />}
      <AbsoluteFill style={{ opacity: 1 - pageOut }}>
        <SpeedBlur vx={0} vy={v} amount={0.32} max={30}>
          <BrowsePage scroll={scroll} />
        </SpeedBlur>
        {/* the rest of the feed dims to 0.38; the stop card lifts with an accent outline */}
        {lift > 0 && (
          <>
            <AbsoluteFill style={{ background: `rgba(8,9,11,${(0.62 * lift).toFixed(3)})` }} />
            <div style={{
              position: 'absolute', left: cx - (card.w * s * press) / 2, top: cy - (card.h * s * press) / 2, width: card.w * s * press, height: card.h * s * press,
              borderRadius: 14 * PAGE_S * s, boxShadow: `0 ${(30 * lift).toFixed(1)}px ${(70 * lift).toFixed(1)}px rgba(0,0,0,${(0.55 * lift).toFixed(3)}), 0 0 0 ${(2 * lift).toFixed(2)}px ${C.accent}`,
            }}>
              <Img src={staticFile('textures/target-card-3x.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14 * PAGE_S * s }} />
            </div>
          </>
        )}
        {/* tap: one thin ring from the touch point */}
        {ring > 0 && ring < 1 && open === 0 && (
          <div style={{
            position: 'absolute', left: tapAt.x - 60, top: tapAt.y - 60, width: 120, height: 120, borderRadius: 60,
            border: '3px solid rgba(242,245,247,0.9)', transform: `scale(${(0.35 + 0.9 * ring).toFixed(3)})`, opacity: 0.85 * (1 - ring),
          }} />
        )}
      </AbsoluteFill>

      {/* shared element in flight: browse art (landscape crop) cross-fades into the listing photo (portrait card) */}
      {open > 0 && (
        <div style={{
          position: 'absolute', left: art.x, top: art.y, width: art.w, height: art.h, overflow: 'hidden',
          borderRadius: mix(12, 12, open) * PAGE_S, boxShadow: `0 ${(40 * Math.sin(Math.PI * open)).toFixed(1)}px ${(90 * Math.sin(Math.PI * open)).toFixed(1)}px rgba(0,0,0,0.5)`,
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 1 - ramp(open, 0.25, 0.5, EASE.smooth),
            backgroundImage: `url(${staticFile('textures/browse-target-3x.png')})`,
            backgroundSize: `${(1080 * art.w) / from.w}px auto`,
            // one uniform scale (the rect's width ratio) so the crop doesn't stretch as the rect turns portrait
            backgroundPosition: `${(-target.face.x * PAGE_S * art.w) / from.w}px ${(-(target.face.y - layout.browse.tiles.target.y) * PAGE_S * art.w) / from.w}px`,
          }} />
          <Img src={staticFile('textures/listing-face-3x.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: ramp(open, 0.25, 0.5, EASE.smooth) }} />
        </div>
      )}
    </AbsoluteFill>
  );
};
