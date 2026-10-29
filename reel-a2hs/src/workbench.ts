// Workbench manifest (video-shotcraft references/workbench.md §2): the reel split into shot / caption / SFX / BGM
// clips from the same tables Main.tsx renders (SHOTS, CAPTIONS, SFX) — never a second copy. Motion constants stay fixed.
import { Main } from './Main';
import { SHOTS, TOTAL, W, H, dur } from './timing';
import { SFX, sfxDuration } from './Sound';
import { C } from './theme';
import { Open } from './shots/Open';
import { SheetRise } from './shots/SheetRise';
import { Steps } from './shots/Steps';
import { Android } from './shots/Android';
import { HomeScreen } from './shots/HomeScreen';
import { Launch } from './shots/Launch';
import { EndCard, END_DEFAULTS } from './shots/EndCard';
import { CAPTIONS, CAPTION_DEFAULTS, CaptionCard } from './shots/Captions';

export const WORKBENCH = {
  name: 'LebanonTCG · Add to Home Screen reel',
  fps: 30, width: W, height: H,
  total: TOTAL,
  background: C.stage,
  shots: [
    { id: 'open', label: 'S1 The site on the phone', from: SHOTS.open.from, duration: dur(SHOTS.open), component: Open },
    { id: 'sheet', label: 'S2 Sheet rises', from: SHOTS.sheet.from, duration: dur(SHOTS.sheet), component: SheetRise },
    { id: 'steps', label: 'S3 Steps · reticle + lifts', from: SHOTS.steps.from, duration: dur(SHOTS.steps), component: Steps },
    { id: 'android', label: 'S4 Android · one tap', from: SHOTS.android.from, duration: dur(SHOTS.android), component: Android },
    { id: 'home', label: 'S5 Icon → home screen', from: SHOTS.home.from, duration: dur(SHOTS.home), component: HomeScreen },
    { id: 'launch', label: 'S6 Tap → app opens', from: SHOTS.launch.from, duration: dur(SHOTS.launch), component: Launch },
    {
      id: 'end', label: 'S7 Lockup', from: SHOTS.end.from, duration: dur(SHOTS.end), component: EndCard, props: { ...END_DEFAULTS },
      schema: [
        { type: 'text', key: 'wordmark', label: 'Wordmark', default: END_DEFAULTS.wordmark },
        { type: 'text', key: 'tagline', label: 'Tagline', default: END_DEFAULTS.tagline },
        { type: 'text', key: 'url', label: 'URL', default: END_DEFAULTS.url },
        { type: 'number', key: 'wordSize', label: 'Wordmark size', default: END_DEFAULTS.wordSize, min: 40, max: 120, step: 2, unit: 'px' },
        { type: 'number', key: 'tagSize', label: 'Tagline size', default: END_DEFAULTS.tagSize, min: 24, max: 60, step: 1, unit: 'px' },
        { type: 'number', key: 'urlSize', label: 'URL size', default: END_DEFAULTS.urlSize, min: 28, max: 80, step: 1, unit: 'px' },
      ],
    },
  ],
  transitions: [],
  captions: CAPTIONS.map((c) => ({
    id: c.id, label: `Caption · ${c.head}`, from: c.from, duration: c.to - c.from, component: CaptionCard,
    props: { head: c.head, sub: c.sub ?? '', from: c.from, to: c.to, ...CAPTION_DEFAULTS },
    schema: [
      { type: 'text', key: 'head', label: 'Headline', default: c.head },
      { type: 'text', key: 'sub', label: 'Sub-line', default: c.sub ?? '' },
      { type: 'number', key: 'headSize', label: 'Headline size', default: CAPTION_DEFAULTS.headSize, min: 40, max: 110, step: 2, unit: 'px' },
      { type: 'number', key: 'subSize', label: 'Sub size', default: CAPTION_DEFAULTS.subSize, min: 24, max: 60, step: 1, unit: 'px' },
      { type: 'number', key: 'top', label: 'Top', default: CAPTION_DEFAULTS.top, min: 60, max: 600, step: 2, unit: 'px' },
    ],
    cardId: 'caption', cardName: 'Caption',
  })),
  overlays: [],
  sfx: SFX.map((s) => ({ from: s.from, duration: sfxDuration(s), src: `sfx/${s.src}`, volume: s.volume })),
  bgm: [{ from: 0, duration: TOTAL, src: 'audio/bgm.mp3', volume: 0.38 }],
  original: Main,
};
