// Sound — BGM bed + declarative SFX pin table (sound-design.md §4.1/§4.6). Real-object sounds only.
// Every pin names the picture event it lands on; `from` is computed so the file's PEAK lands on that frame:
//   from = targetPeakFrame − sourcePeakLag − OUTPUT_AUDIO_OFFSET_F
// Peak lags: analysis/sfx_peaks.json (33 ms envelope argmax). Output offset: analysis/av_offset.json (measured after render).
// Sources: traced Mixkit URLs in the video-shotcraft skill's assets/audio/ATTRIBUTION.md; BGM = bgm-tech-house.mp3
// (Mixkit Stock Music Free License; the skill's attribution notes it cannot be traced to one catalogue entry).
import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { BGM_START_FRAMES, SHOTS, TOTAL, beatF } from './timing';
import { LAND as SHEET_LAND } from './shots/SheetRise';
import { TAP as ANDROID_TAP } from './shots/Android';
import { LAND as ICON_LAND } from './shots/HomeScreen';
import { TAP as LAUNCH_TAP, WIN1 } from './shots/Launch';
import { LAND as LOCK_LAND, LETTERS0, URL0 } from './shots/EndCard';

export const OUTPUT_AUDIO_OFFSET_F = 0; // measured on the delivery path (analysis/av_offset.json)

const PEAK_F: Record<string, number> = {
  'air-woosh-quick.mp3': 7.0, 'bass-hit-short.mp3': 2.8, 'click-camera.mp3': 5.6, 'gear-lock-metallic.mp3': 7.2, 'hit-weak.mp3': 4.7,
  'impact-deep-whoosh.mp3': 16.6, 'lock-quick.mp3': 0.8, 'riser-cine.mp3': 22.6, 'sparkle-touch.mp3': 14.4, 'sparkle.mp3': 43.9,
  'sweep-short.mp3': 13.8, 'switch-click-quick.mp3': 0.6, 'switch-light.mp3': 2.0, 'switch-tap.mp3': 0.5, 'swoosh-quick.mp3': 8.6,
  'transition-snap.mp3': 3.5, 'transition-soft.mp3': 13.3, 'typewriter-hit-hard.mp3': 1.5, 'typewriter-hit-soft.mp3': 4.7, 'whoosh-big.mp3': 21.5,
};
const sfxFrom = (targetPeakF: number, src: string) => Math.max(0, Math.round(targetPeakF - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));

export type Pin = { from: number; src: string; volume: number; dur?: number; note: string };
const pin = (target: number, src: string, volume: number, note: string, dur?: number): Pin => ({ from: sfxFrom(target, src), src, volume, note, dur });

const S = SHOTS;
export const SFX: Pin[] = [
  // S2 · the sheet rises into the drop (b8): a quick air whoosh peaking on the landing, a soft hit as it lands
  pin(S.sheet.from + SHEET_LAND, 'air-woosh-quick.mp3', 0.6, 'sheet rises (whoosh into the landing, b8)'),
  pin(S.sheet.from + SHEET_LAND + 1, 'hit-weak.mp3', 0.4, 'sheet lands'),
  // S3 · push into the steps; the reticle bites step 1 (b13); a switch tap as each step lifts
  pin(S.steps.from + 10, 'sweep-short.mp3', 0.45, 'camera pushes into the steps'),
  pin(beatF(14), 'lock-quick.mp3', 0.55, 'reticle bites step 1 (b14)'),
  pin(beatF(17), 'switch-tap.mp3', 0.42, 'step 2 lifts (b17)'),
  pin(beatF(20), 'switch-click-quick.mp3', 0.4, 'step 3 lifts (b20)'),
  // S4 · the Android sheet arrives; the tap on its button (b23)
  pin(S.android.from + 6, 'transition-soft.mp3', 0.28, 'iOS sheet → Android sheet'),
  pin(S.android.from + ANDROID_TAP, 'switch-tap.mp3', 0.7, 'tap on Add to Home Screen (b24)'),
  // S5 · the icon lifts and flies; snap + sparkle on the landing (b27.5)
  pin(S.home.from + 8, 'swoosh-quick.mp3', 0.55, 'icon lifts off the sheet'),
  pin(S.home.from + ICON_LAND, 'transition-snap.mp3', 0.6, 'icon lands in its slot (b28.5)'),
  pin(S.home.from + ICON_LAND + 4, 'sparkle-touch.mp3', 0.35, 'the label settles'),
  // S6 · tap on the icon; the window opens into the app view
  pin(S.launch.from + LAUNCH_TAP, 'switch-click-quick.mp3', 0.7, 'tap on the icon'),
  pin(S.launch.from + WIN1 - 2, 'whoosh-big.mp3', 0.5, 'the window grows into the app'),
  // S7 · riser → deep impact on the lockup landing (film peak, b36.5) → sparkle; one key on the wordmark, a click on the URL
  pin(S.end.from + LOCK_LAND, 'riser-cine.mp3', 0.45, 'riser into the lockup'),
  pin(S.end.from + LOCK_LAND, 'impact-deep-whoosh.mp3', 0.55, 'icon brakes into place (b37.5)'),
  pin(S.end.from + LETTERS0 + 6, 'sparkle.mp3', 0.3, 'wordmark sets (sparkle)'),
  pin(S.end.from + LETTERS0, 'typewriter-hit-hard.mp3', 0.5, 'first letter'),
  pin(S.end.from + URL0 + 4, 'switch-click-quick.mp3', 0.4, 'URL'),
];

// BGM: 0.38 under the effects; ducked ~5 dB under the sheet landing, the window opening and the lockup impact
const BGM_LEVEL = 0.38;
const DUCK: [number, number, number][] = [
  [S.sheet.from + SHEET_LAND - 10, S.sheet.from + SHEET_LAND + 8, 0.56],
  [S.launch.from + WIN1 - 20, S.launch.from + WIN1 + 6, 0.6],
  [S.end.from + LOCK_LAND - 12, S.end.from + LOCK_LAND + 16, 0.5],
];
const bgmVolume = (f: number) => {
  const fade = interpolate(f, [0, 3, TOTAL - 14, TOTAL - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const duck = DUCK.reduce((k, [a, b, g]) => Math.min(k, interpolate(f, [a - 4, a, b, b + 6], [1, g, g, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })), 1);
  return BGM_LEVEL * fade * duck;
};

export const sfxDuration = (s: Pin) => s.dur ?? 90;

export const Sound: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm && <Audio src={staticFile('audio/bgm.mp3')} trimBefore={BGM_START_FRAMES} volume={bgmVolume} />}
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={sfxDuration(s)} name={`sfx · ${s.note}`}>
        <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume} />
      </Sequence>
    ))}
  </>
);
