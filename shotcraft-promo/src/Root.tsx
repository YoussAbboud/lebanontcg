import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { FPS, TOTAL } from './timing';
import { loadFonts } from './fonts';

loadFonts();

export const Root: React.FC = () => (
  <>
    <Composition id="LtcgPromo" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true, vertical: false }} />
    {/* the same timeline, re-framed for 9:16 (fmt.tsx) */}
    <Composition id="LtcgPromoVertical" component={Main} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} defaultProps={{ bgm: true, vertical: true }} />
  </>
);
