// Workbench manifest (references/workbench.md §2): the film split into shot / SFX / BGM clips, from the same tables
// Main.tsx renders (SHOTS, TITLES, SFX) — never a second copy. Title-card copy is editable (text DSL); the motion
// constants (eases, timings, camera keys) stay fixed by design.
import { Main } from './Main';
import { SHOTS, TOTAL } from './timing';
import { SFX } from './Sound';
import { C } from './theme';
import { BrandOpen } from './shots/BrandOpen';
import { HeroCard } from './shots/HeroCard';
import { DeckDeal } from './shots/DeckDeal';
import { TitleCard, TITLES } from './shots/TitleCard';
import { CrashAuction } from './shots/CrashAuction';
import { ChatEmbed } from './shots/ChatEmbed';
import { PregradeScan } from './shots/PregradeScan';
import { Outro } from './shots/Outro';

const titleSchema = [{ type: 'text', key: 'text', label: 'Copy (*accent*, " / " = line break)', default: '' }];
const title = (id: 't1' | 't2' | 't3', shot: { from: number; dur: number }, label: string) => ({
  id, label, from: shot.from, duration: shot.dur, component: TitleCard,
  props: { text: TITLES[id], duration: shot.dur }, schema: titleSchema, durationProp: 'duration',
  cardId: 'title-card', cardName: 'Title card',
});

export const WORKBENCH = {
  name: 'LebanonTCG · promo',
  fps: 30, width: 1920, height: 1080,
  total: TOTAL,
  background: C.bg,
  shots: [
    { id: 'open', label: 'S0 Brand open', from: SHOTS.open.from, duration: SHOTS.open.dur, component: BrandOpen },
    { id: 'hero', label: 'S1 The listing', from: SHOTS.hero.from, duration: SHOTS.hero.dur, component: HeroCard },
    { id: 'deal', label: 'S2 The deal', from: SHOTS.deal.from, duration: SHOTS.deal.dur, component: DeckDeal },
    title('t1', SHOTS.title1, 'T1 Live auctions'),
    { id: 'auction', label: 'S3 Anti-snipe', from: SHOTS.auction.from, duration: SHOTS.auction.dur, component: CrashAuction },
    title('t2', SHOTS.title2, 'T2 Chat'),
    { id: 'chat', label: 'S4 Deal in chat', from: SHOTS.chat.from, duration: SHOTS.chat.dur, component: ChatEmbed },
    title('t3', SHOTS.title3, 'T3 Pre-Grade'),
    { id: 'pregrade', label: 'S5 Pre-Grade', from: SHOTS.pregrade.from, duration: SHOTS.pregrade.dur, component: PregradeScan },
    { id: 'outro', label: 'S6 Finale', from: SHOTS.outro.from, duration: SHOTS.outro.dur, component: Outro },
  ],
  transitions: [],
  captions: [],
  overlays: [],
  sfx: SFX.map((s) => ({ from: s.from, duration: s.dur ?? 150, src: `sfx/${s.src}`, volume: s.volume })),
  bgm: [{ from: 0, duration: TOTAL, src: 'audio/bgm.mp3', volume: 0.34 }],
  original: Main,
};
