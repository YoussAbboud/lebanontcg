// LebanonTCG 15s Reel — the timeline. SHOTS (timing.ts) is the single source of truth; every cut is a beat.
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SHOTS, dur } from './timing';
import { Opening } from './shots/Opening';
import { Browse } from './shots/Browse';
import { Listing } from './shots/Listing';
import { EndCard } from './shots/EndCard';
import { Sound } from './Sound';
import { C } from './theme';
import { useFontsReady } from './fonts';

export const Main: React.FC<{ bgm: boolean }> = ({ bgm }) => {
  useFontsReady();
  return (
    <AbsoluteFill style={{ backgroundColor: C.stage }}>
      <Sequence from={SHOTS.opening.from} durationInFrames={dur(SHOTS.opening)} name="S1 Opening · cards tumble in → portal"><Opening /></Sequence>
      <Sequence from={SHOTS.browse.from} durationInFrames={dur(SHOTS.browse)} name="S2 Browse · scroll-brake → open"><Browse /></Sequence>
      <Sequence from={SHOTS.listing.from} durationInFrames={dur(SHOTS.listing)} name="S3 Listing"><Listing /></Sequence>
      <Sequence from={SHOTS.end.from} durationInFrames={dur(SHOTS.end)} name="S4 End card · flip → logo → Buy. Sell. Trade."><EndCard /></Sequence>
      <Sound bgm={bgm} />
    </AbsoluteFill>
  );
};
