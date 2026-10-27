# Review inputs — LebanonTCG 15s Reel (video-shotcraft, autonomous free-creation mode)

Paths are relative to `/home/user/lebanontcg/reel-15s` unless absolute. Skill root: `/home/user/lebanontcg/.agents/skills/video-shotcraft` (= `$SK`).

## Deliverables under review
- `out/qa/draft2-reel.mp4` (with BGM) and `out/qa/draft2-reel-nobgm.mp4` (SFX only, same timeline). 1080×1920, 30 fps, 450 frames.
- Key frames: `review/frames/f<NNNN>.png` (frame index = Remotion frame) and per-shot contact sheets `review/sheets/*.png`.
- Reference renders from the **exact demo TSX** of each card (half scale): `review/ref/<card>.mp4`, `review/ref/<card>/f*.png`, `review/ref/<card>-sheet.png` (card-flock-tumble, scroll-brake-moves [ChangelogScrollBrake], shot-transitions-portal [PortalWipeV2], ui-to-brand-morph [IconFlipBloomLogo]). The Gallery reference clips (github.io) are unreachable from this environment.

## Client brief (verbatim)
> Use video-shotcraft to create a 15-second cinematic Instagram Reel advertisement for https://lebanontcg.com.
> Format: 1080x1920, 9:16, 30 FPS.
> Brand colors: Dark gray: #2a2f38 · Neon green: #d3fc3b
> Creative direction: Premium, minimalist, modern trading-card advertising. Use actual website screenshots, real brand assets and authentic Pokémon, Yu-Gi-Oh! and Magic: The Gathering card imagery where properly licensed.
> Opening: Trading cards enter the frame through smooth 3D motion.
> Middle: Reveal the LebanonTCG marketplace and demonstrate browsing cards.
> Ending: Display the logo and "Buy. Sell. Trade." followed by lebanontcg.com.
> Use clean typography, minimal text, polished transitions, subtle sound effects, and rhythmic music.
> Avoid generic AI-generated imagery, excessive glows, random gradients, fake website interfaces and unnecessary decorative elements.
> Use autonomous free-creation mode. Render an MP4 and provide an editable Remotion project.

## Basis documents
- Production spec (stages 0–3, recorded decisions, storyboard): `DESIGN-SPEC.md`.
- Card docs `$SK/references/shots/<category>/<card>.md`; demo TSX `$SK/demos/<category>/<card>/*.tsx`; index `$SK/gallery/api/library.json`.
- Checklists: `$SK/references/final-review.md`, `$SK/references/aesthetic-rules.md`; audio: `$SK/references/sound-design.md`, `$SK/references/music-beat-sync.md`; audio sources `$SK/assets/audio/ATTRIBUTION.md`.
- Shot source `src/shots/*.tsx`; timing `src/timing.ts`; SFX pin table `src/Sound.tsx`; brand tokens `src/theme.ts`; capture script `capture/capture.mjs`; real-page textures `public/textures/`; layout `src/layout.json`.
- Analysis: `analysis/beat_data.json` (BGM grid), `analysis/sfx_peaks.json`, `analysis/pins.json`, `analysis/av_check.py` (run: `cd analysis && uv run --with librosa --with scipy --python 3.11 python -I av_check.py <with> <without> pins.json`).
- Editable-project instructions: `README.md`.
- Data: all on-screen pages are the repository's own site build in mock mode; handles, prices and bids are fictional seed data (`/home/user/lebanontcg/src/mock/seed.ts`).
