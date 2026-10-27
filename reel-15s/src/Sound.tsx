// Sound — BGM bed + declarative SFX pin table (sound-design.md §4.1/§4.6). Subtle, real-object sounds only.
// Every pin names the picture event it lands on; `from` is computed so the file's PEAK lands on that frame:
//   from = targetPeakFrame − sourcePeakLag − OUTPUT_AUDIO_OFFSET_F
// Peak lags: analysis/sfx_peaks.json (analysis/sfx_peaks.py: 33 ms envelope argmax). Output offset: analysis/av_offset.json.
// Sources: every file has a traced Mixkit URL in the video-shotcraft skill's assets/audio/ATTRIBUTION.md;
// BGM = house-vibez.mp3 (Lily J, Mixkit Stock Music Free License).
import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { BGM_START_FRAMES, SHOTS, TOTAL, beatF } from './timing';
import { OPEN, SCROLL0, SCROLL1, TAP } from './shots/Browse';

export const OUTPUT_AUDIO_OFFSET_F = 0; // measured on the delivery path (analysis/av_offset.json)

const PEAK_F: Record<string, number> = {
  'hit-weak.mp3': 4.7, 'lock-quick.mp3': 0.8, 'paper-move-quick.mp3': 9.5, 'paper-slide.mp3': 10.4, 'sweep-short.mp3': 13.8,
  'switch-click-quick.mp3': 0.6, 'switch-tap.mp3': 0.5, 'swoosh-quick.mp3': 8.6, 'transition-snap.mp3': 3.5,
  'typewriter-hit-hard.mp3': 1.5, 'typewriter-hit-soft.mp3': 4.7,
};
const sfxFrom = (targetPeakF: number, src: string) => Math.max(0, Math.round(targetPeakF - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));

type Pin = { from: number; src: string; volume: number | ((f: number) => number); dur?: number; note: string };
const pin = (target: number, src: string, volume: number, note: string): Pin => ({ from: sfxFrom(target, src), src, volume, note });

const S = SHOTS;
const B = S.browse.from;
const E = S.end.from;
export const SFX: Pin[] = [
  // S1 · cards tumble in (the flight's fastest stretch) and land on b3; the portal opens into the drop (b8)
  pin(S.opening.from + 14, 'paper-slide.mp3', 0.8, 'cards slide through the air'),
  pin(beatF(3), 'paper-move-quick.mp3', 0.5, 'the stack lands (b3)'),
  pin(beatF(8) - 4, 'sweep-short.mp3', 0.62, 'portal opens onto the Browse page (drop, b8)'),
  // S2 · paging under the fast scroll (fades as it brakes), a soft lock as it settles, the tap, the open
  {
    from: B + SCROLL0, src: 'paper-browse-bed.mp3', dur: SCROLL1 - SCROLL0, note: 'feed scrolls (paging bed, fades with the brake)',
    volume: (f: number) => 0.85 * Math.pow(Math.max(0, 1 - f / (SCROLL1 - SCROLL0)), 1.2),
  },
  pin(B + SCROLL1 - 1, 'lock-quick.mp3', 0.26, 'the scroll settles on Red-Eyes'),
  pin(B + TAP, 'switch-tap.mp3', 0.75, 'tap (b15)'),
  pin(B + Math.round((OPEN[0] + OPEN[1]) / 2), 'swoosh-quick.mp3', 0.62, 'card art grows into the listing photo'),
  // S4 · card lifts off the page, flips flat (thinnest on b24), the mark blooms; one key per word; the URL click
  pin(E + 8, 'paper-slide.mp3', 0.8, 'card lifts off the page'),
  pin(beatF(24), 'transition-snap.mp3', 0.75, 'flip flat → mark (b24)'),
  pin(beatF(24) + 3, 'hit-weak.mp3', 0.32, 'mark blooms open'),
  pin(E + 89, 'typewriter-hit-soft.mp3', 0.9, 'BUY. (b27)'),
  pin(E + 94, 'typewriter-hit-hard.mp3', 0.7, 'SELL.'),
  pin(E + 99, 'typewriter-hit-soft.mp3', 0.95, 'TRADE.'),
  pin(E + 104, 'switch-click-quick.mp3', 0.45, 'lebanontcg.com (b28)'),
];

// BGM: 0.38 (the effects sit on top of it), ducked ~5 dB under the three moments the effects carry the picture and
// ~2.5 dB under the tagline keys (they land on kick beats; measured masked below 2 kHz without it)
const BGM_LEVEL = 0.38;
const DUCK: [number, number, number][] = [[beatF(8) - 18, beatF(8) + 6, 0.56], [B + SCROLL0, B + SCROLL1, 0.56], [B + OPEN[0], B + OPEN[1], 0.56], [E + 86, E + 108, 0.75]];
const bgmVolume = (f: number) => {
  const fade = interpolate(f, [0, 3, TOTAL - 14, TOTAL - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const duck = DUCK.reduce((k, [a, b, g]) => Math.min(k, interpolate(f, [a - 4, a, b, b + 6], [1, g, g, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })), 1);
  return BGM_LEVEL * fade * duck;
};

export const Sound: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm && (
      <Audio
        src={staticFile('audio/bgm.mp3')}
        trimBefore={BGM_START_FRAMES}
        // in fast (the film opens mid-groove), ducked under three effects, out over the last 14f so the reel loops clean
        volume={bgmVolume}
      />
    )}
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur ?? 60} name={`sfx · ${s.note}`}>
        <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume} />
      </Sequence>
    ))}
  </>
);
