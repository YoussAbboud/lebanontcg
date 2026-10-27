// S2 · Browse — scroll-brake-moves A (changelog-scroll-brake) on the real mobile Browse page, then tap → open.
// Adapted from demos/data/scroll-brake-moves/ChangelogScrollBrake.tsx.
//
// Kept: 50f scroll on cubic-bezier(0.45,0,0.06,1) (~5f to full speed, long exponential tail); vertical SpeedBlur driven by
// the frame-to-frame displacement (amount 0.32, max 30px, auto-clears when stopped); the stop card lifts 14f EASE.out to
// 1.03× with a deeper shadow and a 2px accent outline while the rest dims to 0.38; the target stops at frame centre.
// The demo's fake changelog rows are the real Browse feed. The run is ~2 frame heights (the demo's ~2.2) so cards pass
// with readable structure in the slow-down, and the stop — Red-Eyes B. Dragon, a different seller and colour from the
// first card — reads as a new card. On a lime card the accent outline is set 6px off the edge on a dark rim so it reads.
// Blurred frames show the 1× base; every frame you can read is a 3× capture.
// Then: a tap (press 0.985 + one ring) on b15, and the card's art (its own 3× crop) grows into the listing photo — a
// shared-element open. The Browse page fades to the page ground first; the listing page arrives only once the art is
// over its photo slot, so nothing crosses the flying art. Lands on S3's first frame (b17).
//
// Local timeline (abs = local + 119):  0–30 hold on the page top (≥30f after the portal) · 30–80 scroll + brake ·
//   80–94 lift · 103 tap (b15) · 105–132 shared-element open (art → listing photo)
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, SpeedBlur, bezier, mix, ramp } from '../fixtures/Polish';
import layout from '../layout.json';
import { C } from '../theme';
import { BrowsePage, ListingPage, PAGE_S, VH, rectOnScreen } from './Page';

export const SCROLL0 = 30;
export const SCROLL1 = 80;
const LIFT0 = 80;
export const TAP = 103;
export const OPEN = [105, 132] as const;

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
  const ring = ramp(frame, TAP, 14, EASE.out);
  const open = interpolate(frame, [OPEN[0], OPEN[1]], [0, 1], { easing: Easing.bezier(0.7, 0, 0.3, 1), ...CL });
  const browseOut = interpolate(open, [0, 0.4], [0, 1], { ...CL, easing: EASE.smooth }); // feed → page ground first
  const listingIn = interpolate(open, [0.55, 1], [0, 1], { ...CL, easing: EASE.smooth }); // listing arrives under the art

  const card = rectOnScreen(target, scroll);
  const s = (1 + 0.03 * lift) * press;
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
  // shared element: browse card art → listing photo (S3 starts at scroll 0)
  const from = rectOnScreen(target.face, scroll);
  const fromScaled = { x: cx + (from.x - cx) * s, y: cy + (from.y - cy) * s, w: from.w * s, h: from.h * s };
  const to = rectOnScreen(layout.listing.face, 0);
  const art = { x: mix(fromScaled.x, to.x, open), y: mix(fromScaled.y, to.y, open), w: mix(fromScaled.w, to.w, open), h: mix(fromScaled.h, to.h, open) };
  const tapAt = { x: fromScaled.x + fromScaled.w * 0.5, y: fromScaled.y + fromScaled.h * 0.55 };
  const rad = 12 * PAGE_S;

  return (
    <AbsoluteFill style={{ background: '#0b0c10' }}>
      {listingIn > 0 && (
        <AbsoluteFill style={{ opacity: listingIn }}>
          <ListingPage scroll={0} hideFace />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ opacity: 1 - browseOut }}>
        <SpeedBlur vx={0} vy={v} amount={0.32} max={30}>
          <BrowsePage scroll={scroll} />
        </SpeedBlur>
        {/* the rest of the feed dims to 0.38; the stop card lifts with an offset accent outline on a dark rim */}
        {lift > 0 && (
          <>
            <AbsoluteFill style={{ background: `rgba(8,9,11,${(0.62 * lift).toFixed(3)})` }} />
            <div style={{
              position: 'absolute', left: cx - (card.w * s) / 2, top: cy - (card.h * s) / 2, width: card.w * s, height: card.h * s,
              borderRadius: 14 * PAGE_S * s,
              boxShadow: `0 ${(30 * lift).toFixed(1)}px ${(70 * lift).toFixed(1)}px rgba(0,0,0,${(0.55 * lift).toFixed(3)}), 0 0 0 ${(6 * lift).toFixed(2)}px #08090b, 0 0 0 ${(8 * lift).toFixed(2)}px ${C.accent}`,
            }}>
              <Img src={staticFile('textures/target-card-3x.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14 * PAGE_S * s }} />
            </div>
          </>
        )}
        {/* tap: one ring from the touch point (dark rim + white core so it reads on any card colour) */}
        {ring > 0 && ring < 1 && (
          <div style={{
            position: 'absolute', left: tapAt.x - 70, top: tapAt.y - 70, width: 140, height: 140, borderRadius: 70,
            border: '5px solid rgba(255,255,255,0.95)', boxShadow: '0 0 0 3px rgba(8,9,11,0.55), inset 0 0 0 3px rgba(8,9,11,0.55)',
            transform: `scale(${(0.3 + 0.9 * ring).toFixed(3)})`, opacity: 1 - ring,
          }} />
        )}
      </AbsoluteFill>

      {/* shared element in flight: the card's own art crop, cross-fading into the listing photo */}
      {open > 0 && (
        <div style={{
          position: 'absolute', left: art.x, top: art.y, width: art.w, height: art.h, overflow: 'hidden', borderRadius: rad,
          boxShadow: `0 ${(40 * Math.sin(Math.PI * open)).toFixed(1)}px ${(90 * Math.sin(Math.PI * open)).toFixed(1)}px rgba(0,0,0,0.5)`,
        }}>
          <Img src={staticFile('textures/target-face-3x.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 1 - ramp(open, 0.3, 0.45, EASE.smooth) }} />
          <Img src={staticFile('textures/listing-face-3x.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: ramp(open, 0.3, 0.45, EASE.smooth) }} />
        </div>
      )}
    </AbsoluteFill>
  );
};
