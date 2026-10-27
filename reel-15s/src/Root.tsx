import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { FPS, H, TOTAL, W } from './timing';
import { loadFonts } from './fonts';

loadFonts();

export const Root: React.FC = () => (
  <Composition id="LtcgReel" component={Main} durationInFrames={TOTAL} fps={FPS} width={W} height={H} defaultProps={{ bgm: true }} />
);
