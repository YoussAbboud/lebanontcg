// Captions — blur-slide (typography/blur-slide): each word's opacity, y and blur share ONE progress on one ease-out, so
// words surface out of focus rather than slide in and fade. Head words 3 f apart (18 f each, 0.44 em travel, 12 % blur),
// sub words 2.4 f apart (20 f each) overlapping the head by ~16 f so the pair reads as one sentence. Out: an 8 f
// lift-and-fade. Every caption is fully formed for ≥30 f before its exit starts (readable-duration rule).
// The CAPTIONS table is derived from SHOTS (timing.ts) and is the single source for Main, Sound and the workbench.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { SHOTS } from '../timing';
import { C, FONT } from '../theme';
import { EASE, ramp } from '../fixtures/Polish';

export type Caption = { id: string; from: number; to: number; head: string; sub?: string };
export const CAPTIONS: Caption[] = [
  { id: 'c1', from: SHOTS.open.from + 15, to: SHOTS.sheet.from + 20, head: 'LebanonTCG, on your phone.', sub: 'Open www.lebanontcg.com in Safari or Chrome.' },
  { id: 'c2', from: SHOTS.sheet.from + 20, to: SHOTS.steps.from + 22, head: 'A sheet shows you how.', sub: 'Two seconds after the page loads.' },
  { id: 'c3', from: SHOTS.steps.from + 24, to: SHOTS.android.from, head: 'Three taps on iPhone.', sub: 'Share · Add to Home Screen · Add' },
  { id: 'c4', from: SHOTS.android.from, to: SHOTS.home.from + 22, head: 'On Android, one tap.' },
  { id: 'c5', from: SHOTS.home.from + 20, to: SHOTS.launch.from + 20, head: "It's on your home screen." },
  { id: 'c6', from: SHOTS.launch.from + 22, to: SHOTS.end.from + 30, head: 'Opens full screen. Like an app.', sub: 'No browser bar.' },
];

export const CAPTION_DEFAULTS = { headSize: 64, subSize: 34, top: 180 };

const Words: React.FC<{ text: string; start: number; gap: number; dur: number; dy: number; blur: number; out: number; style: React.CSSProperties }> = ({ text, start, gap, dur, dy, blur, out, style }) => {
  const frame = useCurrentFrame();
  const leave = ramp(frame, out - 8, 8, EASE.exit);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: '0.28em', rowGap: 0, opacity: 1 - leave, transform: `translateY(${(-20 * leave).toFixed(2)}px)`, ...style }}>
      {text.split(' ').map((w, i) => {
        const p = ramp(frame, start + i * gap, dur, EASE.out);
        return (
          <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${((1 - p) * dy).toFixed(2)}px)`, filter: p >= 0.999 ? undefined : `blur(${((1 - p) * blur).toFixed(2)}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** One caption pair at the top band of the frame (absolute frames; mount it for [from, to)). */
export const CaptionCard: React.FC<{ head: string; sub?: string; from: number; to: number; headSize?: number; subSize?: number; top?: number }> = ({
  head, sub, from, to, headSize = CAPTION_DEFAULTS.headSize, subSize = CAPTION_DEFAULTS.subSize, top = CAPTION_DEFAULTS.top,
}) => (
  <div style={{ position: 'absolute', left: 90, width: 900, top, pointerEvents: 'none' }}>
    <Words
      text={head.toUpperCase()} start={from} gap={3} dur={18} dy={28} blur={8} out={to}
      style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: headSize, lineHeight: 1.06, letterSpacing: '-0.01em', color: C.ink, textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}
    />
    {sub && (
      <Words
        text={sub} start={from + 16} gap={2.4} dur={20} dy={14} blur={5} out={to}
        style={{ marginTop: 14, fontFamily: FONT.sans, fontWeight: 500, fontSize: subSize, lineHeight: 1.3, color: C.accent, letterSpacing: '0.005em' }}
      />
    )}
  </div>
);

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {CAPTIONS.filter((c) => frame >= c.from - 2 && frame < c.to).map((c) => (
        <CaptionCard key={c.id} head={c.head} sub={c.sub} from={c.from} to={c.to} />
      ))}
    </>
  );
};
