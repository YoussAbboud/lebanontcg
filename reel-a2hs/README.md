# LebanonTCG — "Add to Home Screen" reel (editable Remotion project)

A 21.3-second 9:16 feature film for lebanontcg.com's new install-to-home-screen sheet, built with the video-shotcraft
skill in autonomous free-creation mode.

- **Renders:** `out/lebanontcg-a2hs.mp4` (with music) and `out/lebanontcg-a2hs-nobgm.mp4` (sound effects only, same picture).
- **Format:** 1080×1920, 30 fps, 639 frames (44 beats at 124.01 BPM).
- **Design record:** `DESIGN-SPEC.md` — brief, decisions, shot mapping, the beat-locked storyboard and what changed in the build.

## Run it

```bash
cd reel-a2hs
npm install
npm run studio        # live preview + scrubbing (Remotion Studio)
npm run render        # → out/lebanontcg-a2hs.mp4 and out/lebanontcg-a2hs-nobgm.mp4 (needs ffmpeg on PATH)
```

## What to edit where

| Change | File |
|---|---|
| Caption wording, sizes, position | `src/shots/Captions.tsx` (`CAPTIONS`, `CAPTION_DEFAULTS`) |
| Lockup words, URL, sizes | `src/shots/EndCard.tsx` (`END_DEFAULTS`) |
| Brand colours / fonts | `src/theme.ts` (`C.stage` = #2a2f38, `C.accent` = #d3fc3b) |
| Cut points (all on the music's beat grid) | `src/timing.ts` (`SHOTS`, `beatF(n)`) |
| The drawn home screen (grid, slot, dock) | `src/shots/HomeScreen.tsx` |
| Sound effects and their volumes | `src/Sound.tsx` (`SFX`; each pin lands the file's peak on a named frame) |
| Music level / start point in the track | `src/Sound.tsx` (BGM volume), `src/timing.ts` (`BGM_START_FRAMES`) |
| The screenshots | `capture/capture.mjs`, then `npm run capture` (see below) |

## Screenshots

Everything inside the phone screen is a real page of the site in its mobile layout — the home page and the install
sheet in both of its variants (iPhone Safari wording; Android Chrome with the one-tap button) — captured from this
repository's own build in mock mode. The home screen the icon lands on is drawn (a phone home screen cannot be
captured headlessly): neutral unbranded tiles, a status bar and a dock built from the site's colour tokens; only the
LebanonTCG icon (`public/icon-512.png`, the site's real icon) is real content.

Every handle and listing in the captures is fictional seed data; the card art is the site's placeholder art.

To re-capture (e.g. from the live site):

```bash
# mock build served locally
VITE_MOCK=1 npx vite build && npx vite preview --port 4319      # in the repo root
npm run capture                                                 # writes public/textures + src/layout.json
# or the live site
BASE=https://www.lebanontcg.com CHROME=/path/to/chromium npm run capture
```

## Sound and music licences

- **Music:** `bgm-tech-house.mp3`, Mixkit Stock Music Free License (the skill's attribution file notes it could not be
  traced back to a single catalogue entry — re-confirm before commercial use).
- **Sound effects:** Mixkit Sound Effects Free License, each traced in the video-shotcraft skill's
  `assets/audio/ATTRIBUTION.md`.

The renderer is Remotion; check [its licence](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) for
company use.
