// Beat grid — the single source of truth for every cut and SFX pin (music-beat-sync.md §4).
// Analysis (analysis/beat_data.json): bgm-tech-house.mp3, fitted 123.992 BPM, t0 = 9.4519 s, max residual 7.6 ms.
// The film starts 167 frames (5.5667 s) into the track, so film beat 0 sits 0.0140 s after frame 0
// and the track's full-energy entry (track beat 12) lands on film beat 20.
export const FPS = 30;
export const BGM_START_FRAMES = 167;
export const SOURCE_BEAT0 = 0.014; // film-time seconds of beat 0 (source analysis, never mixed with output offsets)
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // measured 0 on the delivery path (analysis/av_offset.json, sound-design §4.6)
export const BEAT_INT = 60 / 123.992;
export const beatT = (n: number) => SOURCE_BEAT0 + OUTPUT_AUDIO_OFFSET_SEC + n * BEAT_INT;
export const beatF = (n: number) => Math.round(beatT(n) * FPS);

const span = (a: number, b: number) => ({ from: beatF(a), dur: beatF(b) - beatF(a), beats: [a, b] as const });
export const SHOTS = {
  open: span(0, 8),
  hero: span(8, 20),
  deal: span(20, 31),
  title1: span(31, 35),
  auction: span(35, 46), // starts one beat early so the crash (local 44, LEAD 1) hits b38 = frame 552
  title2: span(46, 50),
  chat: span(50, 58),
  title3: span(58, 62),
  pregrade: span(62, 72),
  outro: span(72, 84),
};
export const TOTAL = beatF(84);
// local frame of an absolute beat inside a shot
export const local = (shot: { from: number }, n: number) => beatF(n) - shot.from;
