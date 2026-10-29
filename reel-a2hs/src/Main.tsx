// LebanonTCG · Add to Home Screen reel — the timeline. SHOTS (timing.ts) is the single source of truth; every cut is a beat.
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SHOTS, dur } from './timing';
import { Open } from './shots/Open';
import { SheetRise } from './shots/SheetRise';
import { Steps } from './shots/Steps';
import { Android } from './shots/Android';
import { HomeScreen } from './shots/HomeScreen';
import { Launch } from './shots/Launch';
import { EndCard } from './shots/EndCard';
import { Captions } from './shots/Captions';
import { Sound } from './Sound';
import { C } from './theme';
import { useFontsReady } from './fonts';

export const Main: React.FC<{ bgm: boolean }> = ({ bgm }) => {
  useFontsReady();
  return (
    <AbsoluteFill style={{ backgroundColor: C.stage }}>
      <Sequence from={SHOTS.open.from} durationInFrames={dur(SHOTS.open)} name="S1 Open · the site on the phone"><Open /></Sequence>
      <Sequence from={SHOTS.sheet.from} durationInFrames={dur(SHOTS.sheet)} name="S2 Sheet rises"><SheetRise /></Sequence>
      <Sequence from={SHOTS.steps.from} durationInFrames={dur(SHOTS.steps)} name="S3 Steps · reticle + three lifts"><Steps /></Sequence>
      <Sequence from={SHOTS.android.from} durationInFrames={dur(SHOTS.android)} name="S4 Android · one tap"><Android /></Sequence>
      <Sequence from={SHOTS.home.from} durationInFrames={dur(SHOTS.home)} name="S5 Home screen · icon travels"><HomeScreen /></Sequence>
      <Sequence from={SHOTS.launch.from} durationInFrames={dur(SHOTS.launch)} name="S6 Launch · tap → window"><Launch /></Sequence>
      <Sequence from={SHOTS.end.from} durationInFrames={dur(SHOTS.end)} name="S7 Lockup"><EndCard /></Sequence>
      <Captions />
      <Sound bgm={bgm} />
    </AbsoluteFill>
  );
};
