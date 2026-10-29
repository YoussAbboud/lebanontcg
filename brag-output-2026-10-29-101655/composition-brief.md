# Hyperframes Composition Brief: LebanonTCG — on your home screen

## Objective
Create a short launch-style brag video for LebanonTCG's new "Add to Home Screen" feature.

## Output
- Composition directory: `brag-output-2026-10-29-101655/work/composition/`
- Rendered video: `brag-output-2026-10-29-101655/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 18.2 seconds (34 beats at 112 BPM)

## Source Material
- Project root: /home/user/lebanontcg
- Primary files read: src/components/AddToHomePrompt.tsx, src/components/addtohome.css, src/lib/install.ts, public/manifest.webmanifest, public/sw.js, index.html, src/styles/tokens.css
- Product name: LebanonTCG
- Tagline / strongest claim: "Opens full screen like an app, one tap from your home screen. No app store, nothing to download." (the sheet's own sub-line)
- Key UI or visual moment to recreate: the install sheet rising over the real home page; its three step rows; the acid Android button; the site's icon on a home screen; the app opening full screen
- Copy that must appear verbatim (from the product):
  - ADD LEBANONTCG TO YOUR HOME SCREEN (the sheet, in the capture)
  - Tap the Share button at the bottom of the screen. / Scroll down and tap Add to Home Screen. / Tap Add in the top corner. (the step rows, in the capture)
  - ADD TO HOME SCREEN (the Android button, in the capture)
  - LebanonTCG (the home-screen label)
  - www.lebanontcg.com

## Creative Direction
- Tone preset: default
- Creative direction: "there's no app — and you still get one"
- Interpretation: deadpan setup (two hook lines, hard beats), then the real sheet does the demonstrating; big type that holds; one accent; the only invented visuals are the numerals and the drawn home screen
- Angle: see brag-plan.md
- Hook: NO APP STORE. / NO DOWNLOAD. — then the phone rises
- Outro / punchline: LEBANONTCG. · ADD IT TO YOUR HOME SCREEN · www.lebanontcg.com
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Any third-party app branding on the drawn home screen

## Visual Identity
- Background: #08090b
- Text: #f2f5f7 / #b9c2cc
- Accent: #d6ff3f
- Display font: Chakra Petch 700 (assets/fonts, @font-face)
- Body font: Inter (as "LTCG Sans"); labels JetBrains Mono (as "LTCG Mono")
- Visual references from the project: assets/img/home-3x.png (home page, mobile), sheet-ios-4x.png, sheet-android-4x.png (the sheet's two variants), icon.png (the site's icon), flag.png (the lockup mark). Capture geometry: work/layout.json (CSS px at 390 wide; the phone renders at 800 wide → ×2.0513)

## Storyboard
Use the storyboard in brag-plan.md as the creative contract.

Scene summary:
1. No app — 2.1 s — NO APP STORE. / NO DOWNLOAD. slam in; the phone rises on beat 4
2. The sheet — 2.1 s — the real sheet rises in the phone (beat 6); caption A SHEET SHOWS YOU HOW.
3. Three taps — 3.2 s — the three real step rows lift out and stack with giant numerals, one per beat (9, 10, 11)
4. Android — 1.6 s — the acid button slides in; a tap on 15.5
5. Home screen — 3.2 s — the icon flies to a drawn home screen (lands 19), tap on 21, the app opens by 23
6. Full screen — 2.1 s — the app view holds; OPENS FULL SCREEN. / Like an app. No browser bar.
7. Outro — 3.75 s — flag + LEBANONTCG. (28), ADD IT TO YOUR HOME SCREEN (29), URL (29.75), held

LOOK: a dark stage, one acid accent, the real phone screens doing the talking, big uppercase Chakra Petch lines that land hard and hold.

## Audio
- Audio role: dense rhythmic layer, synthesized on the beat grid (work/synth.py), one file assets/audio/soundtrack.wav
- Audio arc: hook hits → full groove from the phone's arrival → drums out at the lockup, one chord and a bell to the end
- Music: assets/audio/soundtrack.wav (synthesized; no external track)
- Music treatment: in from frame 0; drums off from beat 28; the chord rings to the end
- Music cue guidance: the grid is the cue source (beat n = n × 0.5357 s)
- Audio-reactive treatment: none beyond the grid
- Audio-coupled moments: hook slams (1, 2); phone lands (4); sheet slides (6); card pops (9, 10, 11); drop (14); tap (15.5); flight whoosh (17); landing thump + sparkle (19); tap (21); window whoosh (21.2); cover (27); bell (28)
- SFX selection guidance: synthesized in the same file; dry hits, clean clicks, no comedy sounds
- Audio files: assets/audio/soundtrack.wav

## Hyperframes Instructions
One composition (compositions/film.html) on a 1080×1920 root, GSAP timeline registered as window.__timelines['film']; every cue at T(n) = n × 60/112 s; seek-safe tweens (fromTo with immediateRender:false for visible from-states, set for swaps); no CSS transforms on GSAP-transformed elements; assets root-relative; run `npx hyperframes check` as the gate before render.
