// LebanonTCG promo — the timeline. SHOTS (timing.ts) is the single source of truth; every cut is a beat.
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SHOTS } from './timing';
import { BrandOpen } from './shots/BrandOpen';
import { HeroCard } from './shots/HeroCard';
import { DeckDeal } from './shots/DeckDeal';
import { TitleCard, TITLES } from './shots/TitleCard';
import { CrashAuction } from './shots/CrashAuction';
import { ChatEmbed } from './shots/ChatEmbed';
import { PregradeScan } from './shots/PregradeScan';
import { Outro } from './shots/Outro';
import { C } from './theme';
import { Sound } from './Sound';
import { useFontsReady } from './fonts';
import { FmtProvider } from './fmt';

export const Main: React.FC<{ bgm: boolean; vertical?: boolean }> = ({ bgm, vertical = false }) => {
  useFontsReady();
  return (
  <FmtProvider vertical={vertical}>
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Sequence from={SHOTS.open.from} durationInFrames={SHOTS.open.dur}><BrandOpen /></Sequence>
    <Sequence from={SHOTS.hero.from} durationInFrames={SHOTS.hero.dur}><HeroCard /></Sequence>
    <Sequence from={SHOTS.deal.from} durationInFrames={SHOTS.deal.dur}><DeckDeal /></Sequence>
    <Sequence from={SHOTS.title1.from} durationInFrames={SHOTS.title1.dur}><TitleCard text={TITLES.t1} duration={SHOTS.title1.dur} /></Sequence>
    <Sequence from={SHOTS.auction.from} durationInFrames={SHOTS.auction.dur}><CrashAuction /></Sequence>
    <Sequence from={SHOTS.title2.from} durationInFrames={SHOTS.title2.dur}><TitleCard text={TITLES.t2} duration={SHOTS.title2.dur} /></Sequence>
    <Sequence from={SHOTS.chat.from} durationInFrames={SHOTS.chat.dur}><ChatEmbed /></Sequence>
    <Sequence from={SHOTS.title3.from} durationInFrames={SHOTS.title3.dur}><TitleCard text={TITLES.t3} duration={SHOTS.title3.dur} /></Sequence>
    <Sequence from={SHOTS.pregrade.from} durationInFrames={SHOTS.pregrade.dur}><PregradeScan /></Sequence>
    <Sequence from={SHOTS.outro.from} durationInFrames={SHOTS.outro.dur}><Outro /></Sequence>
    <Sound bgm={bgm} />
  </AbsoluteFill>
  </FmtProvider>
  );
};
