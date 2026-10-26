// T1–T3 · paper-title-card, adapted from demos/typography/paper-title-card/PaperTitleCard.tsx (dark version of the same recipe).
// Kept: per-word letterpress (delay 4+i·4, 9f, bezier(0.2,0.75,0.3,1), scale 1.28→1 + blur 7→0), exactly one accent word
// (italic + accent), accent underline scaleX 16→34f, 8f fade-out. Re-skinned: graphite ground with a faint violet
// key light instead of paper; Chakra Petch 700 caps instead of serif; acid accent. Slot is 58f (4 beats).
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { FONT, Grain } from '../fixtures/Polish';
import { C } from '../theme';

export type Word = { text: string; accent?: boolean; br?: boolean };

// Text DSL (editable in the workbench): words split by spaces, *word* = the one accent word, ' / ' = line break.
export const parseWords = (text: string): Word[] => {
  const out: Word[] = [];
  for (const raw of text.split(' ')) {
    if (raw === '/') { if (out.length) out[out.length - 1].br = true; continue; }
    const accent = raw.startsWith('*') && raw.endsWith('*');
    out.push({ text: accent ? raw.slice(1, -1) : raw, accent });
  }
  return out;
};

export const TitleCard: React.FC<{ text: string; duration: number }> = ({ text, duration }) => {
  const words = parseWords(text);
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const underline = interpolate(frame, [16, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1) });
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(1100px 700px at 50% 44%, rgba(216,222,233,0.055), rgba(216,222,233,0) 68%)' }} />
      <div style={{ textAlign: 'center', maxWidth: 1600, opacity: fadeOut }}>
        <div style={{ fontFamily: FONT.display, fontSize: 124, fontWeight: 700, lineHeight: 1.08, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.01em', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.26em' }}>
          {words.map((w, i) => {
            const delay = 4 + i * 4;
            const t = interpolate(frame, [delay, delay + 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.75, 0.3, 1) });
            return (
              <React.Fragment key={i}>
                <span style={{ opacity: t, transform: `scale(${1.28 - 0.28 * t})`, filter: `blur(${(1 - t) * 7}px)`, display: 'inline-block', fontStyle: w.accent ? 'italic' : 'normal', color: w.accent ? C.acid : undefined }}>
                  {w.text}
                </span>
                {w.br && <span style={{ flexBasis: '100%', height: 0 }} />}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ height: 6, width: 220, margin: '42px auto 0', borderRadius: 3, background: C.acid, transform: `scaleX(${underline})` }} />
      </div>
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};

export const TITLES = {
  t1: 'Live auctions. / Nobody gets *sniped.*',
  t2: 'Winning opens a *chat* / with the seller.',
  t3: '*Pre-Grade* / before you list.',
} as const;
