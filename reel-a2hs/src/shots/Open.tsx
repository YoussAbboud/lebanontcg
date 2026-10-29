// S1 · Open — the real home page in the screen, settling from a 4% push to rest (professional curve, 24 f), then still
// while the first caption reads. The first frame already shows the page.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { HomePage, Screen } from '../Screen';
import { PRO } from '../theme';
import { mix, ramp } from '../fixtures/Polish';

export const Open: React.FC = () => {
  const f = useCurrentFrame();
  const s = mix(1.04, 1, ramp(f, 0, 24, PRO));
  return (
    <Screen bar={1}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${s.toFixed(5)})`, transformOrigin: '50% 40%' }}>
        <HomePage />
      </div>
    </Screen>
  );
};
