# LebanonTCG — "Add to Home Screen" reel · video-shotcraft design spec (autonomous free-creation mode)

Mode: **autonomous free creation** (`references/pipeline.md`), chosen by the user ("2- autonomous go ahead"). Stages 0–3
were decided by the agent and are recorded here; no approval stops. Shot cards were not specified by the user.

## Stage 0 — Brief

- **Product:** LebanonTCG (www.lebanontcg.com), Lebanon's peer-to-peer trading-card marketplace: list a card, chat with
  the seller, meet in person. Dark UI (`#08090b` ground, `#d6ff3f` acid accent), Chakra Petch display type, Inter body,
  JetBrains Mono labels.
- **Feature to show (shipped today):** the site installs on a phone's home screen. On a phone a sheet slides up a couple
  of seconds after the site loads: the icon as it will sit on the home screen, the title "Add LebanonTCG to your Home
  Screen", "Opens full screen like an app, one tap from your home screen. No app store, nothing to download.", and the
  taps for that phone's browser — iPhone: Share → Add to Home Screen → Add; Android Chrome: one acid **Add to Home
  Screen** button. Installed, it opens full screen with no browser bar (`src/components/AddToHomePrompt.tsx`,
  `public/manifest.webmanifest`, `public/sw.js`).
- **Deliverable:** a vertical reel, 1080×1920, 30 fps, 610 frames (20.33 s), with and without music, plus this editable
  Remotion project. Vertical because the subject is a phone feature.
- **Audience:** collectors in Lebanon who already use the site on their phone; the ask is one action (add it).

### Requirement → execution decisions

| Requirement | Decision |
|---|---|
| Show the real feature | Real captures of the site in its mobile layout (390-px viewport at 3–4×) from this repository's offline mock build (fictional seed data, the site's placeholder card art) — `capture/capture.mjs`. The sheet's two variants are captured as the site renders them: iPhone Safari wording and Android Chrome with the one-tap button (the capture dispatches the same `beforeinstallprompt` event Chrome would). |
| The home-screen payoff | A phone home screen cannot be captured headlessly, so it is **drawn** (non-replica UI, allowed by Q1): a dark wallpaper from the site's tokens, a status bar, a grid of neutral unlabeled tiles and a dock. Only the LebanonTCG icon (`public/icon-512.png`, the site's real icon) and its label are real content; no other app's branding appears. |
| Data safety | Mock build only: handles, listings and bids are seed data; the only real-looking imagery is the site's own icon and flag. The capture suppresses the mock-only dev user switcher. |
| Framing | The page sits in a rounded "screen" (844×1500, radius 52) on a flat `#2a2f38` stage, leaving the top band for captions — the same stage/accent tokens as the earlier 15 s reel so the two films read as one campaign. No device bezel. |
| Music | `bgm-tech-house.mp3` (Mixkit Stock Music Free License; the skill's attribution notes it cannot be traced to a single catalogue entry — re-confirm before commercial use), 124.01 BPM. Window: track beat 25 (12.358 s) → 42 film beats. The track's full-energy drop (track beat 33) lands on film beat 8, where the sheet lands. Delivered with and without BGM. |
| SFX | Real-object sounds only, traced Mixkit sources: air whoosh, soft hit, light-switch taps, a quick lock, a snap, sparkle, riser → deep impact for the lockup. No synthetic UI tones. |
| Text | Six captions in the site's own type, one idea each, plus the lockup (wordmark, "NOW ON YOUR HOME SCREEN", URL). The sheet's own copy is the product talking. |

## Stage 1 — Visual direction

Three directions considered:
1. **Phone on the stage (chosen).** The real page in a rounded screen on the flat `#2a2f38` stage, captions above it in
   Chakra Petch; the only invented surface is the home screen, drawn from the site's tokens. Energy: medium, precise;
   tone: premium/serious (same as the earlier reel). Everything on screen is product-real except the drawn home screen.
2. Full-bleed page with captions over the hero. Rejected: the captions collide with the page's own headline.
3. 3D phone mock-up orbit. Rejected: a bezel adds nothing the feature needs, and the site's tokens already carry the
   brand.

**Styleframe: skipped, with reason.** The look is fixed by the site's captures, its fonts and the campaign's two stage
colours; the one drawn element (home screen) is specified below in tokens and verified on stills in stage 5.

Tokens:

| Token | Value |
|---|---|
| Stage | `#2a2f38` flat |
| Accent | `#d3fc3b` (single accent: caption sub-lines, highlights, URL) |
| Text | `#f2f5f7` / `#b9c2cc` |
| Display | Chakra Petch 700, uppercase, 72 px captions (≥56 px floor, Q11); sub 36 px Inter 500 |
| Screen | 844×1500 at (118, 330), radius 52; page scale 844/390 = 2.164 |
| Home screen | wallpaper `#08090b` with the site's `--fan-floor` radial glow; tiles `#16191e`→`#1f242b`, 24 px radius; 4 columns; dock `rgba(255,255,255,0.06)` |
| Motion | preset "professional" (bezier(0,0,0.2,1) ~21 f) for camera and captions; the sheet keeps the product's own curve (cubic-bezier(0.2,0.9,0.3,1), 0.42 s); springs only on the icon landing and the lockup brake |

## Stage 2 — Feature → shot mapping

| Beat | Card (style) | Why | Backup |
|---|---|---|---|
| The site on a phone | PageCam-style push-in on the real page (no card; camera only) | establishes the real site before anything happens | `crane-rise-reveal` |
| The sheet rises | the product's own motion (its CSS curve, replicated) | the feature's signature movement; a card's choreography would misrepresent it | `list-reveal` |
| "Look at the steps" | `fui-hud-moves` A reticle-lock-on, once, on step 1 (Share) | the one "look here" the viewer must catch; the card's ≤2-per-film rule respected (1 use) | `crash-zoom-punch` |
| Steps 1→2→3 | step-through: each step card lifts (1.03×, accent outline) at a person's pace (≥1 s each), others dim | shows the real taps without a cursor; one technique, one set-piece | `speed-ramp-freeze` |
| Android: one tap | tap ring + button press on the real acid button | the feature's second truth in one beat | — |
| Icon to the home screen | shared-element travel (transition-travel family: the icon is present in both scenes) landing in a real grid slot (Q9) | the payoff carried by one object | `shot-transitions` A |
| Opening the app | `shot-transitions` C portal-wipe (the icon grows into the real page) | the native "tap to open" idiom; the page inside is the app view (no browser bar) | `circle-match-iris` |
| Captions | `blur-slide` (words share one progress for y/blur/opacity) | the default, non-competing text reveal | — |
| Lockup | `logo-shrink-wordmark-lockup` adapted: the icon shrinks with the brake overshoot, shifts left, the wordmark letters stagger in, the tagline and URL close | a "stamp" ending at the film's energy level | `ui-to-brand-morph` A |

Each technique is the hero exactly once (the reticle once, the step lift once as a set-piece, the travel once, the portal once).

## Stage 3 — Storyboard (beat-locked, 610 f)

Beat frames: b0 1 · b6 88 · b8 117 · b12 175 · b13 189 · b16 233 · b19 276 · b22 320 · b23 334 · b25 363 · b27.5 400 · b30 436 · b31 451 · b35 509 · b36.5 531 · b38 553 · b40 582 · b42 610.

| # | Frames | Beats | Shot | Action | Caption | SFX |
|---|---|---|---|---|---|---|
| S1 | 0–88 | b0–b6 | Open | The real home page in the screen, settling from 1.04× to 1.00× (24 f, professional curve), then still. Caption words blur-slide in from b0.5. | **LebanonTCG, on your phone.** / sub: *Open www.lebanontcg.com in Safari or Chrome.* | (music build-up) |
| S2 | 88–175 | b6–b12 | Sheet | The page dims (the site's own 0.78 overlay) and the sheet rises with the product's curve, landing on b8 (the drop). Hold to read ≥50 f. Caption swaps at b8.5. | **A sheet shows you how.** / sub: *Two seconds after the page loads.* | air whoosh into b8, soft hit on landing |
| S3 | 175–320 | b12–b22 | Steps | Camera pushes into the steps (1→1.3 over 20 f, professional). Reticle flies in and bites step 1 on b13 with the label SHARE; step 1 lifts. b16: reticle fades, step 2 lifts (ADD TO HOME SCREEN); b19: step 3 lifts (ADD). Each ≥43 f. | **Three taps on iPhone.** / sub: *Share · Add to Home Screen · Add* | sweep on the push-in, quick lock on the bite, a switch tap per step |
| S4 | 320–363 | b22–b25 | Android | The iOS sheet crossfades to the Android sheet (8 f); a tap ring lands on the acid button on b23 (button presses 0.97×). | **On Android, one tap.** | soft transition, switch tap |
| S5 | 363–436 | b25–b30 | Home | The page and sheet dissolve to the drawn home screen (12 f) while the icon lifts from the sheet's tile (scale 1→1.25, elevation) and flies on an arc to the empty grid slot, landing on b27.5 with an overshoot; the label "LebanonTCG" fades in under it. Hold ≥30 f. | **It's on your home screen.** | swoosh on the lift, snap + sparkle on the landing |
| S6 | 436–509 | b30–b35 | Launch | Tap ring on the icon (b30+6, press squash). The icon grows into the screen as a window (40 f, bezier(0.7,0,0.3,1)); the real page grows inside from 0.66→1 with the same t; the icon face fades in the first 28 % of travel. Hold ≥30 f on the app view (no browser bar). | **Opens full screen. Like an app.** | click on the tap, big whoosh landing with the window |
| S7 | 509–610 | b35–b42 | End | The screen fades to the stage; the icon (5.4× → 1×, in-out cubic with the +6 % brake) lands on b36.5; shifts left (b37–b38); LEBANONTCG. letters stagger in (b38–b39.5, the dot last); "NOW ON YOUR HOME SCREEN" fades in on b40; www.lebanontcg.com on b40.5. Holds ≥1 s. | lockup only | riser from b35 → deep impact on b36.5 (film peak) → sparkle at b38; one key on the wordmark, a click on the URL |

Holds: sheet read 58 f (b8→b12 minus the caption swap), each step ≥43 f, home screen ≥36 f after landing, app view ≥30 f,
lockup 1.2 s. Whole-frame impacts: 0. Caption floor: 72 px display / 36 px sub (Q11). Sheet text read at 1.3× push-in:
step text 14 css px × 2.164 × 1.3 = 39 px.

## Stage 4 — Capture

`capture/capture.mjs` against the mock build (`VITE_MOCK=1 npx vite build && npx vite preview --port 4319`), viewport
390×693 (one 9:16 frame of CSS height), reduced motion so the fan and sheet are at rest, clock frozen. Outputs:
`public/textures/home-3x.png` (first screen, sheet suppressed), `home-sheet-3x.png` (reference), `sheet-ios-4x.png`,
`sheet-android-4x.png`, and `src/layout.json` with the sheet, tile, title, steps, icons and buttons in CSS px.
Brand: `public/icon-512.png` (the site's icon), `public/brand-card.svg` (the flag card, favicon).

## Frame-level plan (stage 5)

| shot | from | duration | content | QA stills |
|---|---|---|---|---|
| open | 0 | 88 | page settles 1.04→1 (0–24), caption in (15–60) | 30, 80 |
| sheet | 88 | 87 | overlay 0→0.78 (0–12), sheet y +sheetH→0 over 13 f landing at local 29 (b8), caption swap at local 36 | 117, 160 |
| steps | 175 | 145 | push 1→1.3 (0–20); reticle fly 8–18, bite at 14 (b13); step1 lift 14–58; step2 58–101; step3 101–145 | 189, 240, 300 |
| android | 320 | 43 | crossfade 0–8; tap ring 14 (b23) | 334, 350 |
| home | 363 | 73 | dissolve 0–12; icon flight 0–37 (lands b27.5 = local 37); label 43; hold | 380, 400, 430 |
| launch | 436 | 73 | tap 6; window 10–50; hold 50–73 | 442, 470, 500 |
| end | 509 | 101 | screen fade 0–12; icon shrink 3–22 (brake 22–28, lands b36.5 = local 22); shift 29–44; letters 44–66; tagline 73; url 80 | 531, 560, 600 |
