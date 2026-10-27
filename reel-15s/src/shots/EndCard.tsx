// S4 · End card — ui-to-brand-morph A (icon-flip-bloom), adapted from demos/outro/ui-to-brand-morph/IconFlipBloomLogo.tsx.
//
// The trading card the viewer just opened leaves the page (which dissolves to the brand stage), wiggles (anticipation,
// alternating growing tilts, inOut(sin), pivot low at 78%), flips flat on Y (scaleX 1→0.04, Easing.in(cubic), two ghost
// frames + ≤5px blur), and on the thinnest frame swaps for the LebanonTCG flag-card mark, which blooms back open on the
// demo's overshoot spring (damping 11, stiffness 130, mass 0.9). The swap is invisible because both are 1:1.4 cards —
// the site's own logo GIF spins exactly like this. Then the lockup sets: the wordmark letter by letter (scale 1.9→1 +
// blur 14→0, snappy, pivot on the baseline), "BUY." "SELL." "TRADE." one per beat, and the URL on the strongest kick.
// Adaptations: vertical lockup (mark over wordmark) for 9:16; brand stage #2a2f38; the only accent is #d3fc3b (the
// periods and the URL); no backdrop light, no glow.
//
// Local timeline (abs = local + 310):
//   0–14   page dissolves; the card flies from its place on the page to centre
//   13–33  anticipation wobble        33–45  flip flat (thinnest at 45 = b24, abs 355)
//   45–    mark blooms (spring)       50–68  mark settles up into the lockup (in-out)
//   52–86  wordmark letters (2.4f stagger, 10f each)
//   89 / 96 / 104  BUY. (b27) / SELL. (half-beat) / TRADE. (b28) — only after the wordmark has set
//   111    lebanontcg.com (84px, the slogan's size)    111–140 sign-off hold with a 1.5% push
// The ending is deliberately calm (a premium sign-off on the groove), not the film's energy peak — recorded in the spec.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EASE, mix, ramp } from '../fixtures/Polish';
import layout from '../layout.json';
import { C, FONT } from '../theme';
import { W } from '../timing';
import { ListingPage, rectOnScreen } from './Page';
import { LISTING_END_SCROLL } from './Listing';

const FLIGHT = [0, 14] as const;
const WOBBLE = [13, 33] as const; // after the flight, not over it (the demo's 22f, 2f shorter)
const FLIP = [33, 45] as const; // thinnest on b24 (abs 355)
const SETTLE = [50, 68] as const;
const WORD0 = 52;
const STAGGER = 2.4; // the card's minimum legible per-letter stagger
const WORDS = [{ t: 'BUY', at: 89 }, { t: 'SELL', at: 96 }, { t: 'TRADE', at: 104 }]; // b27 · half-beat · b28 (wordmark set at 86)
const URL_AT = 111;
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const CARD_H = 760; // centre stage size of the card / mark (1:1.4)
const MARK_H = 440; // the mark's size in the lockup
const STAGE_CY = 720;
const LOCK_CY = 600;
const WORDMARK = 'LEBANONTCG';

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1 · the card leaves the page
  const fly = ramp(frame, FLIGHT[0], FLIGHT[1] - FLIGHT[0], EASE.swift);
  const pageOut = ramp(frame, 0, 14, EASE.smooth);
  const from = rectOnScreen(layout.listing.face, LISTING_END_SCROLL);
  const toW = CARD_H / 1.4;
  const card = {
    x: mix(from.x, W / 2 - toW / 2, fly), y: mix(from.y, STAGE_CY - CARD_H / 2, fly),
    w: mix(from.w, toW, fly), h: mix(from.h, CARD_H, fly),
  };

  // 2 · anticipation + flip flat
  const wb = (k: number) => WOBBLE[0] + ((WOBBLE[1] - WOBBLE[0]) * k) / 4;
  const wobble = interpolate(frame, [wb(0), wb(1), wb(2), wb(3), wb(4)], [0, -8, 10, -12, 0], { ...CL, easing: Easing.inOut(Easing.sin) });
  const flipIn = interpolate(frame, [FLIP[0], FLIP[1]], [0, 1], { ...CL, easing: Easing.in(Easing.cubic) });
  const cardScaleX = mix(1, 0.04, flipIn);
  const ghosts = frame >= FLIP[0] && frame < FLIP[1] ? [0.12, 0.24] : [];

  // 3 · bloom into the mark, then settle up into the lockup
  const bloom = frame < FLIP[1] ? 0 : spring({ frame: frame - FLIP[1], fps, config: { damping: 11, stiffness: 130, mass: 0.9 } });
  const markScaleX = mix(0.04, 1, bloom);
  const settle = ramp(frame, SETTLE[0], SETTLE[1] - SETTLE[0], EASE.smooth); // in-out: no velocity jump as it starts
  const markH = mix(CARD_H, MARK_H, settle);
  const markCY = mix(STAGE_CY, LOCK_CY, settle);

  // sign-off push (the whole lockup, 1.5%)
  const push = 1 + 0.015 * ramp(frame, URL_AT, 140 - URL_AT, EASE.smooth);
  const url = ramp(frame, URL_AT, 12, EASE.out);

  return (
    <AbsoluteFill style={{ background: C.stage, overflow: 'hidden' }}>
      {/* the listing page, exactly as S3 left it, dissolving to the stage */}
      {pageOut < 1 && (
        <AbsoluteFill style={{ opacity: 1 - pageOut }}>
          <ListingPage scroll={LISTING_END_SCROLL} hideFace />
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ transform: `scale(${push.toFixed(5)})`, transformOrigin: `50% ${LOCK_CY + 300}px` }}>
        {/* the card (until the thinnest frame) */}
        {frame < FLIP[1] && (
          <div style={{ position: 'absolute', left: card.x, top: card.y, width: card.w, height: card.h }}>
            {ghosts.map((g, i) => (
              <div key={i} style={{ position: 'absolute', inset: 0, transform: `scaleX(${Math.min(1, cardScaleX + g)})`, opacity: 0.22 - i * 0.08, filter: 'blur(6px)' }}>
                <Img src={staticFile('textures/listing-face-3x.png')} style={{ width: '100%', height: '100%', borderRadius: 26 }} />
              </div>
            ))}
            <div style={{
              position: 'absolute', inset: 0, transform: `rotate(${wobble.toFixed(3)}deg) scaleX(${cardScaleX.toFixed(4)})`, transformOrigin: 'center 78%',
              filter: flipIn > 0.3 ? `blur(${(flipIn * 5).toFixed(2)}px)` : undefined,
              boxShadow: `0 30px 70px -20px rgba(0,0,0,${(0.55 * fly).toFixed(3)})`, borderRadius: 26,
            }}>
              <Img src={staticFile('textures/listing-face-3x.png')} style={{ width: '100%', height: '100%', borderRadius: 26 }} />
            </div>
          </div>
        )}

        {/* the mark: the site's flag card (public/brand-card.svg = the favicon / spinning logo) */}
        {frame >= FLIP[1] && (
          <div style={{ position: 'absolute', left: W / 2 - markH / 2.8, top: markCY - markH / 2, width: markH / 1.4, height: markH, transform: `scaleX(${markScaleX.toFixed(4)})` }}>
            <Img src={staticFile('brand-card.svg')} style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.35))' }} />
          </div>
        )}

        {/* wordmark: letter by letter, big+soft → set (pivot on the baseline) */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: LOCK_CY + MARK_H / 2 + 56, display: 'flex', justifyContent: 'center', fontFamily: FONT.display, fontWeight: 700, fontSize: 112, lineHeight: 1, letterSpacing: '0.03em', color: C.ink }}>
          {[...WORDMARK, '.'].map((ch, i) => {
            const t = ramp(frame, WORD0 + i * STAGGER, 10, EASE.snappy);
            return (
              <span key={i} style={{
                display: 'inline-block', opacity: t, transform: `scale(${mix(1.9, 1, t).toFixed(4)})`, transformOrigin: '50% 100%',
                filter: t < 0.99 ? `blur(${((1 - t) * 14).toFixed(2)}px)` : undefined, color: ch === '.' ? C.accent : undefined, marginLeft: ch === '.' ? 8 : 0,
              }}>{ch}</span>
            );
          })}
        </div>

        {/* BUY. SELL. TRADE. — one word per beat */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: LOCK_CY + MARK_H / 2 + 222, display: 'flex', justifyContent: 'center', gap: 34, fontFamily: FONT.display, fontWeight: 700, fontSize: 84, lineHeight: 1, letterSpacing: '0.02em', color: C.ink }}>
          {WORDS.map((w) => {
            const t = ramp(frame, w.at, 10, EASE.snappy);
            return (
              <span key={w.t} style={{ display: 'inline-block', opacity: t, transform: `translateY(${((1 - t) * 26).toFixed(2)}px)` }}>
                {w.t}<span style={{ color: C.accent }}>.</span>
              </span>
            );
          })}
        </div>

        {/* URL */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: LOCK_CY + MARK_H / 2 + 356, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 84, letterSpacing: '0', color: C.accent, opacity: url, transform: `translateY(${((1 - url) * 14).toFixed(2)}px)` }}>
          lebanontcg.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
