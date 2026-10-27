// Beat grid — the single source of truth for every cut and SFX pin (music-beat-sync.md §4).
// Analysis (analysis/beat_data.json): house-vibez.mp3, fitted 122.002 BPM (T = 0.491796 s), max residual 13.8 ms.
// The film starts 1772 frames (59.067 s) into the track, at the track's beat 120, so film beat 0 sits 0.0179 s after
// frame 0. The drop (track beat 128) lands on film beat 8.
export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const TOTAL = 450; // 15.0 s
export const BGM_START_FRAMES = 1772;
export const SOURCE_BEAT0 = 0.0179; // film-time seconds of beat 0 (source analysis only)
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // measured after render (analysis/av_offset.json)
export const BEAT_INT = 0.4917963;
export const beatT = (n: number) => SOURCE_BEAT0 + OUTPUT_AUDIO_OFFSET_SEC + n * BEAT_INT;
export const beatF = (n: number) => Math.round(beatT(n) * FPS);

// Shots (absolute frames). The cut points are beats; S1 starts at 0 so the first frame is already moving.
export const SHOTS = {
  opening: { from: 0, to: beatF(8) }, // 0–119
  browse: { from: beatF(8), to: beatF(17) }, // 119–251
  listing: { from: beatF(17), to: beatF(21) }, // 251–310
  end: { from: beatF(21), to: TOTAL }, // 310–450
};
export const dur = (s: { from: number; to: number }) => s.to - s.from;
