// S0 · brand-ink-open, adapted from demos/typography/brand-ink-open/BrandInkOpen.tsx.
// Kept: crosshair draw (v 0→9f, h 8→18f, fade 24→34f), per-glyph letterpress (delay 10+i·3, 12f, scale 1.6→1 + blur 6→0,
// under-glint), kicker typewriter 0.7f/char from 28f with block cursor, ≥1 s full hold, 7f lift-out.
// Re-skinned to the product: graphite ground, acid pen/glint/cursor, Chakra Petch wordmark + flag mark, JetBrains Mono kicker.
// Retimed to the 117f slot: hold 64→110 (46f), lift-out 110→117 ends on the cut (b8).
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { BRAND, COPY, FlagMark } from '../fixtures/Brand';
import { FONT, Grain } from '../fixtures/Polish';
import { C } from '../theme';

const WORDMARK = 'LEBANONTCG';
const KICKER = COPY.tagline;
const OUT0 = 110;
const OUT1 = 117;

export const BrandOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const vDraw = interpolate(frame, [0, 9], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1) });
  const hDraw = interpolate(frame, [8, 18], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.linear });
  const crossFade = interpolate(frame, [24, 34], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const perChar = 0.7;
  const kickStart = 28;
  const kickChars = Math.floor(Math.max(0, frame - kickStart) / perChar);
  const kickDone = kickStart + KICKER.length * perChar;
  const cursorOn = frame >= kickStart && (frame < kickDone || (frame <= 100 && Math.floor((frame - kickDone) / 2) % 2 === 0));

  const brandOut = interpolate(frame, [OUT0, OUT1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.5, 1) });
  // the flag mark presses in with the first glyph
  const markT = interpolate(frame, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.7, 0.25, 1) });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(1100px 620px at 50% 46%, rgba(123,92,255,0.16), rgba(123,92,255,0) 70%)' }} />
      <div style={{ textAlign: 'center', opacity: 1 - brandOut, transform: `translateY(${-brandOut * 40}px) scale(${1 - brandOut * 0.12})` }}>
        <svg width={64} height={64} viewBox="0 0 64 64" style={{ display: 'block', margin: '0 auto 34px', opacity: crossFade }}>
          <line x1={32} y1={2} x2={32} y2={62} stroke={C.acid} strokeWidth={5} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={vDraw} />
          <line x1={2} y1={32} x2={62} y2={32} stroke={C.acid} strokeWidth={5} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={hDraw} />
        </svg>
        <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 34 }}>
          <div style={{ opacity: markT, transform: `scale(${1.6 - 0.6 * markT})`, transformOrigin: 'center bottom', filter: `blur(${(1 - markT) * 6}px)`, marginBottom: 6 }}>
            <FlagMark size={124} />
          </div>
          <div style={{ fontFamily: BRAND.font, fontSize: 140, fontWeight: 700, color: C.ink, letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'pre', display: 'inline-flex', alignItems: 'flex-end' }}>
            {[...WORDMARK, '.'].map((ch, i) => {
              const delay = 10 + i * 3;
              const t = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.7, 0.25, 1) });
              const g = delay + 12;
              const glint = interpolate(frame, [g - 4, g, g + 4], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const dot = ch === '.';
              return (
                <span key={i} style={{ position: 'relative', display: 'inline-block', opacity: t, transform: `scale(${1.6 - 0.6 * t})`, transformOrigin: 'center bottom', filter: `blur(${(1 - t) * 6}px)`, color: dot ? C.acid : undefined, marginLeft: dot ? 18 : 0 }}>
                  {ch}
                  <span style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)', width: `${glint * 100}%`, height: 3, background: C.acid, opacity: glint, borderRadius: 2 }} />
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 34, letterSpacing: '0.14em', color: C.ink2, marginTop: 40, textTransform: 'uppercase', height: 40, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ whiteSpace: 'pre' }}>{KICKER.slice(0, kickChars)}</span>
          <span style={{ display: 'inline-block', width: 16, height: 30, marginLeft: 6, background: C.acid, opacity: cursorOn ? 0.9 : 0 }} />
        </div>
      </div>
      <Grain opacity={0.06} blend="soft-light" />
    </AbsoluteFill>
  );
};
