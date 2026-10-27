// Sound — BGM bed + declarative SFX pin table (sound-design.md §4.1/§4.6). Subtle, real-object sounds only.
// Every pin names the picture event it lands on; `from` is computed so the file's PEAK lands on that frame:
//   from = targetPeakFrame − sourcePeakLag − OUTPUT_AUDIO_OFFSET_F
// Peak lags: analysis/sfx_peaks.json (analysis/sfx_peaks.py: 33 ms envelope argmax). Output offset: analysis/av_offset.json.
// Sources: every file has a traced Mixkit URL in the video-shotcraft skill's assets/audio/ATTRIBUTION.md;
// BGM = house-vibez.mp3 (Lily J, Mixkit Stock Music Free License).
import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { BGM_START_FRAMES, SHOTS, TOTAL, beatF } from './timing';

export const OUTPUT_AUDIO_OFFSET_F = 0; // measured on the delivery path (analysis/av_offset.json)

const PEAK_F: Record<string, number> = {
  'hit-weak.mp3': 4.7, 'lock-quick.mp3': 0.8, 'paper-move-quick.mp3': 9.5, 'paper-slide.mp3': 10.4, 'sweep-short.mp3': 13.8,
  'switch-click-quick.mp3': 0.6, 'switch-tap.mp3': 0.5, 'swoosh-quick.mp3': 8.6, 'transition-snap.mp3': 3.5, 'typewriter-hit-soft.mp3': 4.7,
};
const sfxFrom = (targetPeakF: number, src: string) => Math.max(0, Math.round(targetPeakF - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));

type Pin = { from: number; src: string; volume: number | ((f: number) => number); dur?: number; trim?: number; note: string };
const pin = (target: number, src: string, volume: number, note: string): Pin => ({ from: sfxFrom(target, src), src, volume, note });

const S = SHOTS;
export const SFX: Pin[] = [
  // S1 · cards tumble in (the flight's fastest stretch) and land on b3; the portal opens into the drop (b8)
  pin(S.opening.from + 14, 'paper-slide.mp3', 0.42, 'cards slide through the air'),
  pin(beatF(3), 'paper-move-quick.mp3', 0.5, 'the stack lands (b3)'),
  pin(beatF(8) - 4, 'sweep-short.mp3', 0.32, 'portal opens onto the Browse page (drop, b8)'),
  // S2 · paging under the fast scroll (fades as it brakes), a soft lock on the stop, the tap, the open
  {
    from: S.browse.from + 23, src: 'paper-book-browse-fast.mp3', trim: 46, dur: 50, note: 'feed scrolls (paging bed, fades with the brake)',
    volume: (f: number) => 0.5 * Math.pow(Math.max(0, 1 - f / 50), 1.4),
  },
  pin(beatF(13), 'lock-quick.mp3', 0.26, 'the scroll brakes on the auction (b13)'),
  pin(beatF(14), 'switch-tap.mp3', 0.36, 'tap (b14)'),
  pin(S.browse.from + 122, 'swoosh-quick.mp3', 0.3, 'card art grows into the listing photo'),
  // S4 · card leaves the page, flips flat (thinnest on b23), the mark blooms; one soft key per word; the URL click
  pin(S.end.from + 8, 'paper-move-quick.mp3', 0.42, 'card lifts off the page'),
  pin(beatF(23), 'transition-snap.mp3', 0.38, 'flip flat → mark (b23)'),
  pin(beatF(23) + 3, 'hit-weak.mp3', 0.3, 'mark blooms open'),
  pin(beatF(25), 'typewriter-hit-soft.mp3', 0.42, 'BUY. (b25)'),
  pin(beatF(26), 'typewriter-hit-soft.mp3', 0.42, 'SELL. (b26)'),
  pin(beatF(27), 'typewriter-hit-soft.mp3', 0.46, 'TRADE. (b27)'),
  pin(beatF(28), 'switch-click-quick.mp3', 0.34, 'lebanontcg.com (b28)'),
];

export const Sound: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm && (
      <Audio
        src={staticFile('audio/bgm.mp3')}
        trimBefore={BGM_START_FRAMES}
        // in fast (the film opens mid-groove), out over the last 14f so the reel ends clean and loops
        volume={(f) => interpolate(f, [0, 3, TOTAL - 14, TOTAL - 1], [0, 0.5, 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
    )}
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur ?? 60} name={`sfx · ${s.note}`}>
        <Audio src={staticFile(`sfx/${s.src}`)} trimBefore={s.trim} volume={s.volume} />
      </Sequence>
    ))}
  </>
);
