// Beat grid — the single source of truth for every cut and SFX pin (music-beat-sync.md §4).
// Analysis (analysis/beat_data.json, analysis/grid.json): bgm-tech-house.mp3, grid fitted on the steady 12–62 s
// window: 124.0097 BPM (T = 0.483833 s). The film starts 370 frames (12.3333 s) into the track, at track beat 25
// (12.3584 s), so film beat 0 sits 0.0251 s after frame 0. The track's full-energy drop (track beat 33) is film beat 8.
export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const BGM_START_FRAMES = 370;
export const SOURCE_BEAT0 = 0.0251; // film-time seconds of beat 0 (source analysis only)
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // measured after render (analysis/av_offset.json)
export const BEAT_INT = 0.483833;
export const beatT = (n: number) => SOURCE_BEAT0 + OUTPUT_AUDIO_OFFSET_SEC + n * BEAT_INT;
export const beatF = (n: number) => Math.round(beatT(n) * FPS);
export const TOTAL = beatF(44); // 639 f = 21.3 s

// Shots (absolute frames). Every cut is a beat; S1 starts at 0 so the first frame already shows the page.
export const SHOTS = {
  open: { from: 0, to: beatF(6) }, // the site on the phone, pushing in
  sheet: { from: beatF(6), to: beatF(12) }, // the sheet rises (lands on the drop, b8) and is read
  steps: { from: beatF(12), to: beatF(23) }, // push into the steps; Share is locked on (b14); three steps light in turn
  android: { from: beatF(23), to: beatF(26) }, // the Android sheet: one tap (b24)
  home: { from: beatF(26), to: beatF(31) }, // the icon travels to the home screen (lands b28.5)
  launch: { from: beatF(31), to: beatF(36) }, // tap → the app opens full screen
  end: { from: beatF(36), to: TOTAL }, // lockup (lands b37.5)
};
export const dur = (s: { from: number; to: number }) => s.to - s.from;
/** A beat's frame relative to a shot's start. */
export const localBeat = (s: { from: number }, n: number) => beatF(n) - s.from;
