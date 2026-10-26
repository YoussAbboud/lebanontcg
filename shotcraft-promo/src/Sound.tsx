// Sound — BGM bed + declarative SFX pin table (sound-design.md §4.1/§4.6, S2).
// Every pin is relative (SHOTS.x.from + offset or a beat), and `from` is computed so the file's PEAK lands on the target:
//   from = targetPeakFrame − sourcePeakLag − OUTPUT_AUDIO_OFFSET_F
// Peak lags were measured per file (analysis/sfx_peaks.json). OUTPUT_AUDIO_OFFSET_F is measured on the rendered mp4.
import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { BGM_START_FRAMES, SHOTS, TOTAL, beatF } from './timing';
import { SCAN_FIRES } from './shots/PregradeScan';

export const OUTPUT_AUDIO_OFFSET_F = 0; // measured 0.0 f on the delivery path (render.sh: WAV → ffmpeg AAC), analysis/av_offset.json

const PEAK_F: Record<string, number> = {
  'air-zoom-vacuum.mp3': 13.6, 'data-scan.mp3': 3.7, 'impact-deep-whoosh.mp3': 19.0, 'impact-zoom-quick.mp3': 15.5,
  'lock-quick.mp3': 0.5, 'riser-cine.mp3': 35.0, 'sparkle-touch.mp3': 14.3, 'sparkle.mp3': 42.8, 'switch-click-quick.mp3': 0.2,
  'switch-light.mp3': 2.0, 'switch-tap.mp3': 0.2, 'swoosh-quick.mp3': 10.1, 'transition-snap.mp3': 3.4, 'transition-soft.mp3': 13.6,
  'whoosh-big.mp3': 21.6, 'whoosh-fast.mp3': 21.8,
};
const sfxFrom = (targetPeakF: number, src: string) => Math.max(0, Math.round(targetPeakF - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));

type Pin = { from: number; src: string; volume: number; dur?: number; note: string };
const pin = (target: number, src: string, volume: number, note: string, dur?: number): Pin => ({ from: sfxFrom(target, src), src, volume, dur, note });

const S = SHOTS;
export const SFX: Pin[] = [
  // S0 brand
  pin(S.open.from + 26, 'transition-soft.mp3', 0.32, 'wordmark presses in'),
  pin(S.hero.from, 'whoosh-fast.mp3', 0.3, 'brand lifts out → the page'),
  // S1 hero card (switch on → rise → beam → reseat; each its own sound, S4)
  pin(S.hero.from + 2, 'switch-light.mp3', 1.6, 'the light is switched on (quiet file, measured −10.8 dB → gain)'),
  pin(S.hero.from + 60, 'whoosh-big.mp3', 0.36, 'card rises'),
  pin(S.hero.from + 76, 'sparkle.mp3', 0.45, 'rim-light beam laps'),
  pin(S.hero.from + 142, 'transition-snap.mp3', 0.42, 'card reseats'),
  // S2 deal: one big whoosh, then two fading fast whooshes — no per-card hits (S2 anti-machine-gun)
  pin(S.deal.from + 40, 'whoosh-big.mp3', 0.42, 'pull-out + first cards dealt'),
  pin(S.deal.from + 62, 'whoosh-fast.mp3', 0.32, 'deal accelerates'),
  pin(S.deal.from + 80, 'whoosh-fast.mp3', 0.24, 'last cards blur into one swoosh'),
  // title cards: one shared sound
  pin(S.title1.from + 6, 'swoosh-quick.mp3', 0.34, 'title 1'),
  pin(S.title2.from + 6, 'swoosh-quick.mp3', 0.34, 'title 2'),
  pin(S.title3.from + 6, 'swoosh-quick.mp3', 0.34, 'title 3'),
  // S3 crash zoom — slam #1 on b38
  pin(S.auction.from + 26, 'lock-quick.mp3', 0.3, 'corners lock onto the panel'),
  pin(beatF(38) - 2, 'air-zoom-vacuum.mp3', 0.36, 'crash push'),
  pin(beatF(38), 'impact-zoom-quick.mp3', 0.55, 'hit (b38, slam #1)'),
  // S4 chat
  pin(S.chat.from + 8, 'transition-soft.mp3', 0.28, 'into the thread'),
  pin(S.chat.from + 66, 'switch-tap.mp3', 0.34, 'the offer card clicks into the thread'),
  // S5 Pre-Grade: scan bed + one tick per bracket, alternating samples, volume ladder (S2)
  pin(S.pregrade.from + 10, 'data-scan.mp3', 0.28, 'scan line runs'),
  ...SCAN_FIRES.map((ft, i) =>
    pin(S.pregrade.from + ft + 2, i % 2 ? 'switch-tap.mp3' : 'switch-click-quick.mp3', 0.32 - i * 0.015, `bracket ${i + 1} locks`),
  ),
  // S6 finale: riser → impact → sparkle (4.3 sentence); the stamp is b78 — slam #2
  pin(beatF(78), 'riser-cine.mp3', 0.4, 'group photo assembles (riser peaks on the stamp)'),
  pin(beatF(78), 'impact-deep-whoosh.mp3', 0.55, 'wordmark stamp (b78, slam #2, loudest SFX)'),
  pin(S.outro.from + 103, 'sparkle-touch.mp3', 0.34, 'rule draws out'),
];

export const Sound: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm && (
      <Audio
        src={staticFile('audio/bgm.mp3')}
        trimBefore={BGM_START_FRAMES}
        volume={(f) => interpolate(f, [0, 8, TOTAL - 40, TOTAL - 2], [0, 0.34, 0.34, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
    )}
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur ?? 150} name={`sfx · ${s.note}`}>
        <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume} />
      </Sequence>
    ))}
  </>
);
