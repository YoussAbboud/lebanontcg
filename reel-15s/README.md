# LebanonTCG — 15s Instagram Reel (editable Remotion project)

A 15-second 9:16 ad for lebanontcg.com, built with the video-shotcraft skill in autonomous free-creation mode.

- **Renders:** `out/lebanontcg-reel.mp4` (with music) and `out/lebanontcg-reel-nobgm.mp4` (sound effects only, same picture).
- **Format:** 1080×1920, 30 fps, 450 frames.
- **Design record:** `DESIGN-SPEC.md` covers the brief, decisions, shot mapping and the beat-locked storyboard.

## Run it

```bash
cd reel-15s
npm install
npm run studio        # live preview + scrubbing (Remotion Studio)
npm run render        # → out/lebanontcg-reel.mp4 and out/lebanontcg-reel-nobgm.mp4 (needs ffmpeg on PATH)
```

## What to edit where

| Change | File |
|---|---|
| End-card words, URL, sizes, the lockup's timing | `src/shots/EndCard.tsx` (`WORDS`, `URL_AT`, `MARK_H`, …) |
| Brand colours / fonts | `src/theme.ts` (`C.stage` = #2a2f38, `C.accent` = #d3fc3b) |
| Cut points (all on the music's beat grid) | `src/timing.ts` (`SHOTS`, `beatF(n)`) |
| Sound effects and their volumes | `src/Sound.tsx` (`SFX`; each pin lands the file's peak on a named frame) |
| Music level / start point in the track | `src/Sound.tsx` (BGM volume), `src/timing.ts` (`BGM_START_FRAMES`) |
| Which cards open the reel | `src/shots/Opening.tsx` (`ORDER`, `POSES`) + `capture/capture.mjs` (`OPENING`) |
| Which listing the scroll stops on and opens | `capture/capture.mjs` (`TARGET`, `TARGET_ID`), then re-capture |

## Screenshots and card imagery

Everything on screen is a real page of the site in its mobile layout: Browse and a live-auction listing page, plus the
site's own listing cards and its flag-card logo (`public/brand-card.svg` = the site favicon).

**Where the screenshots came from.** The build environment could not reach lebanontcg.com, so the pages were captured
from this repository's own build in mock mode.
- The UI is exactly the deployed site.
- Every handle, price and bid is fictional seed data.
- The card art is the site's placeholder art.

**Card art and licensing.** No official Pokémon, Yu-Gi-Oh! or Magic: The Gathering artwork is used, because no licence
is held for it.

**To use real listings or licensed card photos,** capture the live site and re-render:

```bash
BASE=https://www.lebanontcg.com CHROME=/path/to/chromium npm run capture   # writes public/textures + src/layout.json
npm run render
```

The capture picks cards by listing title, so change `OPENING`, `TARGET` and `TARGET_ID` in `capture/capture.mjs` to
listings that exist on the live site. Only use card photos you have the rights to show in an ad.

## Sound and music licences

- **Music:** `house-vibez.mp3` by Lily J, Mixkit Stock Music Free License.
- **Sound effects:** Mixkit Sound Effects Free License.

All sources are traced in the video-shotcraft skill's `assets/audio/ATTRIBUTION.md`. The renderer is Remotion; check
[its licence](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) for company use.
