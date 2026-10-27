// Workbench manifest (video-shotcraft references/workbench.md §2): the reel split into shot / SFX / BGM clips from the
// same tables Main.tsx renders (SHOTS, SFX) — never a second copy. Motion constants stay fixed by design.
import { Main } from './Main';
import { SHOTS, TOTAL, W, H, dur } from './timing';
import { SFX } from './Sound';
import { C } from './theme';
import { Opening } from './shots/Opening';
import { Browse } from './shots/Browse';
import { Listing } from './shots/Listing';
import { EndCard } from './shots/EndCard';

export const WORKBENCH = {
  name: 'LebanonTCG · 15s Reel',
  fps: 30, width: W, height: H,
  total: TOTAL,
  background: C.stage,
  shots: [
    { id: 'opening', label: 'S1 Cards tumble in → portal', from: SHOTS.opening.from, duration: dur(SHOTS.opening), component: Opening },
    { id: 'browse', label: 'S2 Browse · scroll-brake → open', from: SHOTS.browse.from, duration: dur(SHOTS.browse), component: Browse },
    { id: 'listing', label: 'S3 Listing', from: SHOTS.listing.from, duration: dur(SHOTS.listing), component: Listing },
    { id: 'end', label: 'S4 Logo · Buy. Sell. Trade.', from: SHOTS.end.from, duration: dur(SHOTS.end), component: EndCard },
  ],
  transitions: [],
  captions: [],
  overlays: [],
  sfx: SFX.map((s) => ({ from: s.from, duration: s.dur ?? 60, src: `sfx/${s.src}`, volume: typeof s.volume === 'number' ? s.volume : 0.5 })),
  bgm: [{ from: 0, duration: TOTAL, src: 'audio/bgm.mp3', volume: 0.38 }],
  original: Main,
};
