// Narration caption (C1: no mute segment; Q11: ≥56px on screen). Product copy only.
// Bottom band with a soft scrim; the line blurs in word-free as one unit, holds, and leaves with the shot.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE, FONT, ramp } from '../fixtures/Polish';
import { C } from '../theme';

export const Caption: React.FC<{ text: string; start: number; end: number }> = ({ text, start, end }) => {
  const frame = useCurrentFrame();
  const inT = ramp(frame, start, 12, EASE.out);
  const outT = ramp(frame, end - 6, 6, EASE.exit);
  const o = inT * (1 - outT);
  if (o <= 0.001) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, opacity: o, background: 'linear-gradient(180deg, rgba(8,9,11,0) 0%, rgba(8,9,11,0.82) 62%, rgba(8,9,11,0.92) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 120, right: 120, bottom: 96, textAlign: 'center', opacity: o, transform: `translateY(${((1 - inT) * 14).toFixed(2)}px)`, filter: inT < 1 ? `blur(${((1 - inT) * 6).toFixed(2)}px)` : undefined, fontFamily: FONT.sans, fontWeight: 600, fontSize: 56, lineHeight: 1.18, color: C.ink, textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}>
        {text}
      </div>
    </>
  );
};
