# LebanonTCG — video-shotcraft design spec (autonomous mode)

Mode: autonomous creation (`references/pipeline.md`), chosen by the user. Stages 0–3 below were decided by the agent and recorded here, not paused for approval.

## Stage 0 — Product brief

- **What:** LebanonTCG (www.lebanontcg.com) is Lebanon's peer-to-peer trading card marketplace. Collectors list Pokémon, Magic, Yu-Gi-Oh! and One Piece cards, bid in live auctions, and settle every deal in chat. No checkout, no fees, no payment through the site.
- **Audience:** card collectors in Lebanon; launch post on social and the site.
- **Core claims (from the project's own copy):**
  - "We connect collectors. You handle the deal." (footer)
  - "List what you own, message the person who has what you want." (home hero)
  - "No checkout, no fees, you agree the terms yourselves." (home hero)
  - "A bid in the final minute extends the clock so nobody is sniped." (Terms); the panel prints "+60s — bid in the final minute."
  - "Bids aren't binding and no payment happens here. Winning just opens a chat with the seller." (auction panel)
  - Pre-Grade: "Is this card worth grading?" / "Eight guided photos. You get a measured centering report, a defect read, an estimated PSA band with confidence…"
  - "Lebanon's peer-to-peer trading card marketplace. List Pokémon, Magic, Yu-Gi-Oh! and One Piece cards…" (site description)
- **Features that must appear:** the listing (atomic unit), browse grid, live auction with anti-snipe extension, chat with the non-binding offer, Pre-Grade.

### Requirement → execution decisions

| Requirement | Decision |
|---|---|
| Format | 1920×1080, 30 fps (skill default; vertical and square cuts already exist from /brag) |
| Length | 84 beats at 124 BPM = 40.6 s (multi-feature promo, 30–60 s band) |
| Language | English (site language) |
| Audio | BGM `bgm-tech-house.mp3` from the skill's library (Mixkit Stock Music Free License), beat-locked; film-grammar SFX from `assets/audio/sfx`. Deliver with-BGM and no-BGM renders |
| Data | Real pages captured from the project's **offline mock build** (`VITE_MOCK=1`). All handles, listings and messages are fictional seed data (`src/mock/seed.ts`); no real user, email, key or internal host appears |
| Capture | Headless Chromium against the mock build at 1920×1080, deviceScaleFactor 2 |

## Stage 1 — Visual direction

Three directions considered:
1. **Product-native dark acid (chosen).** The site's own tokens: graphite/near-black ground, acid `#d6ff3f` as the single accent, hero gradient only on COLLECTORS, Chakra Petch display, JetBrains Mono labels. Energy/tone axes: medium-high energy, playful-serious (a hobby marketplace with real money at stake).
2. Card-shop warm tungsten. Rejected: it would invent a look the product doesn't have.
3. Ink Press paper. Rejected: light paper and amber serif clash with a dark neon product.

**Styleframe: skipped, with reason.** The product has a strict, implemented design system (`src/styles/tokens.css`), and every product shot uses real screenshots, which carry that look exactly. The same tokens were already validated in three rendered cuts (`brag-output*`). Title cards and labels use the tokens directly.

### Tokens

| Token | Value |
|---|---|
| Ground / frame / panel | `#08090b` / `#0e1013` / `#16191e` |
| Text 1 / 2 / muted | `#f2f5f7` / `#b9c2cc` / `#7b8590` |
| Accent (the only one) | acid `#d6ff3f`; ink on acid `#08090b` |
| Brand gradient | `#7b5cff → #35e4ff → #d6ff3f` (COLLECTORS only) |
| Status | online `#34d399`, decline `#ff5c8a` |
| Display | Chakra Petch 700 (+ 700 italic for the one accent word per title card), uppercase |
| Body / labels | Inter 400–600; JetBrains Mono 500 uppercase, tracking 0.08em |
| Motion personality | between "活力大胆" and "亲和友好": entrances ~18–26 f, bezier(0.16,1,0.3,1) family, overshoot ≤1.08 on landings only; the demo-tuned parameters win wherever a card marks them as critical |
| Light | single acid key light; the demos' amber/champagne/tungsten swap to acid or neutral white; the warm-black multiply swaps to graphite `rgba(8,9,11,…)` |

## Stage 2 — Feature → shot mapping

| Feature | Card (style) | Why | Backup |
|---|---|---|---|
| Brand | `brand-ink-open` | wordmark + kicker + 1 s hold, low-energy start | `letterspace-materialize` |
| The listing as atomic unit | `spotlight-hero-card` | one hero, full action arc ≥3 s on a real listing card | `magician-card-flourish` |
| Browse: collectors' cards flowing in | `deck-deal-flyin` | literally dealing trading cards into the browse grid | `card-stack` |
| Live auction, anti-snipe | `crash-zoom-punch` (rebound, `CrashZoomReal`) | "look at this!" punch into the countdown; right-hand readout "+60s" | `scroll-brake-moves` |
| Chat deal + offer | `row-embed` | chat messages and the offer card embed into the real thread | `canvas-materialize-moves` |
| Pre-Grade | `scanline-annotate-focus` | a scan line reads the eight capture slots; status `SLOTS 00/08 → 08/08` | `scan-bracket-sweep` |
| Chapter cards | `paper-title-card`, dark version (same recipe) | three breathing slots, one accent word each | `blur-slide` |
| Finale | `outro-group-photo-launch` | every feature sends one element to the group photo | `logo-shrink-wordmark-lockup` |

Each technique is the hero exactly once (P4).

## Stage 3 — Storyboard (beat-locked)

Music: track offset 5.581 s (= track beat −8 from the fitted t0 9.4519 s). In film time, beat n = n × 0.48385 s (124.0 BPM). The full-energy entry (track beat 12) falls on film beat 20. Grid fit: max residual 7.6 ms, mean onset error 5.0 ms. See `analysis/beat_data.json`.

| # | Beats | Frames | Shot | Card | Key motion | Caption / copy | Transition out |
|---|---|---|---|---|---|---|---|
| S0 | 0–8 | 0–116 | Brand open | brand-ink-open | crosshair → LEBANONTCG. letterpress → kicker typewriter → 1 s hold → lift | kicker: WE CONNECT COLLECTORS. YOU HANDLE THE DEAL. | lift-out into the dark page |
| S1 | 8–20 | 116–290 | The listing | spotlight-hero-card | lights out on the Browse page, the beam hunts and locks the live Red-Eyes card, rise, two rim-light laps, reseat | 3D note: "Every card, / *one listing*." · caption: List what you own, message the person who has what you want. | hard cut on the drop (b20) |
| S2 | 20–32 | 290–465 | The deal | deck-deal-flyin | pile of real listing cards on graphite, anticipation, hard-accelerating deal into the Browse grid, runway hold | tagline: Every card, listed by a collector. · counter: N CARDS LISTED · caption: Pokémon, Magic, Yu-Gi-Oh! and One Piece. | swoosh into title |
| T1 | 32–36 | 465–523 | Title | paper-title-card (dark) | per-word press | Live auctions. Nobody gets *sniped.* | cut |
| S3 | 36–46 | 523–668 | Anti-snipe | crash-zoom-punch / CrashZoomReal | listing page, four acid corners lock the auction panel, crash zoom lands **b38 (slam #1, the strongest kick in reach)**, flash, slide left, readout "+60s" | readout: +60s · A bid in the final minute extends the clock so nobody is sniped. | cut |
| T2 | 46–50 | 668–726 | Title | paper-title-card (dark) | per-word press | Winning opens a *chat* with the seller. | cut |
| S4 | 50–58 | 726–842 | The deal in chat | row-embed | the seeded thread's messages, then the OFFER · NON-BINDING card, drop and embed with acid seams | caption: No checkout, no fees, you agree the terms yourselves. | cut |
| T3 | 58–62 | 842–900 | Title | paper-title-card (dark) | per-word press | *Pre-Grade* before you list. | cut |
| S5 | 62–72 | 900–1045 | Pre-Grade | scanline-annotate-focus | uniform scan over the real Pre-Grade page; each capture slot gets corners and a label; `SLOTS 00/08→08/08`, then `READY TO GRADE` | caption: Eight guided photos. A centering report, a defect read, an estimated PSA band. | riser into finale |
| S6 | 72–84 | 1045–1219 | Finale | outro-group-photo-launch | the listing card, a browse card, the countdown chip, a chat bubble, the offer card, a Pre-Grade slot, the nav… fly in; wordmark stamps **b78 (slam #2)**; ≥30 f sign-off hold | eyebrow: Lebanon's peer-to-peer card marketplace · www.lebanontcg.com | end |

Whole-frame shocks: 2 (b38, b78), spaced 40 beats apart (R4). Wordmark holds ≥1 s at open and close (R1). Every caption is the project's own copy.

### Sound plan (stage 6 fills the table)

The BGM carries the drums; SFX only pin picture-specific actions. Planned: transition-soft on the brand landing; light-clunk + whoosh-big + sparkle + transition-snap on the hero arc; whoosh-big into the deal with fast whooshes fading to a swoosh, not per-card hits; swoosh-quick on each title card; an impact on the crash; drops for the chat rows (sparse); a soft scan tick per slot pair; riser → impact-deep-whoosh → sparkle for the finale.

## As built (deviations from the storyboard, with reasons)

- **Frames:** cuts are `beatF(n)` = round((0.014 + n·60/123.992)·30) on beats 0, 8, 20, 31, 35, 46, 50, 58, 62, 72 → 0, 117, 291, 450, 509, 668, 726, 842, 900, 1046; end 1220 (40.7 s). S2/T1/S3 moved one beat earlier than the storyboard (b31/b35 instead of b32/b36), so the crash keeps the card's ≥30f wide hold and still hits b38 = frame 552, the strongest nearby kick (b39 is weak). The crash enters its demo timeline one frame in (`LEAD = 1`), so HIT = 509 + 43 = 552.
- **S1 note copy:** "List what / *you own.*" (home hero) instead of "Every card, one listing." — product copy beats an invented line. The note sits at ~60 px on screen (Q11).
- **S2 copy:** "Listed by / *collectors.*" + "Pokémon, Magic, Yu-Gi-Oh! and One Piece." + counter "NN CARDS LISTED" (counts landed cards).
- **S3:** the crash target is the whole auction panel (the late-bid state is real: captured on Playwright's frozen clock, mock bots bid too). Hit on b38 (frame 552). The readout is the Terms sentence split over three lines ("+60s"). The header clock (1m 37s) and panel clock (1M 36S) differ by a second in the capture itself, because the page ticks them separately.
- **S4:** five rows (the last five bubbles of the seeded thread, ending on the offer card); camera pushed to 1.5–1.62× so the thread reads at ~27 px instead of ~20 px.
- **S5:** the page is real but its slots are empty (photo upload needs a manual crop step). The labels name what each guided photo checks (CENTERING / CORNER / SURFACE, from the page's own guidance), and the status ends on "EIGHT GUIDED PHOTOS". The slots sit 14 px apart under a paragraph, so none of the card's outside placements is clear. Each label instead covers its slot's own 11 px header row (`header` placement, full slot width, 33 px ≈ 32 px on screen). The caption names what the photos produce: "You get centering, defects and an estimated PSA band." Window scaled 0.86 to give the caption its own band; page scaled 1.143 inside the window for legibility. Machine colour = cyan.
- **S6:** cues 12 + 5i, crane 0–70 f, wordmark side shifted +45 f so the stamp lands on b78; URL line at 56 px. The Luffy card sits at cy 455, clear of the chat bubble above and the auction panel below. The finale build is a slow sweep inside S6 (from frame 1069, peaking on the stamp), not a riser across the S5→S6 cut.
- **Captions (C1):** S4 "No checkout, no fees, you agree the terms yourselves."; S5 "You get centering, defects and an estimated PSA band."; S1/S2/S3 carry their copy in-scene (note / title / readout).
- **Light (V1):** every key and fill glow is neutral cool white (`#d8dee9`, the `ltcg` look's accent2), per the token "single acid key light; otherwise neutral". The violet from the demos' accent2 is removed; the brand gradient stays on COLLECTORS only.
- **Text sizes (Q11):** S2 counter 34 px; S3 eyebrow 34 px; S5 status 38 px × 0.86 ≈ 33 px; S5 labels ≈ 32 px.
- **Audio sources:** every SFX has a traced Mixkit source (skill `assets/audio/ATTRIBUTION.md`). whoosh-big → air-whoosh-powerful, sparkle → shimmer-sparkle-sweep, riser-cine → swoosh-slow. **The BGM `bgm-tech-house.mp3` is listed there as not traceable to a Mixkit entry ("confirm before commercial use"); its licence is unverified.**
- **Audio path:** Remotion WAV → ffmpeg AAC 320k for both deliveries (`render.sh`). Remotion's own AAC put the mix 42.7 ms late. Measurements: `analysis/av_offset.json`, `analysis/av_backtest.json`.
- **S2 table (render performance):** the demo paints its graphite table as CSS gradients and an feTurbulence tile on a ~10k × 12k px plane. Under this machine's software GL, that costs ~20 s per frame and the render times out. The same CSS is pre-rendered once by Chromium (`capture/bake-table.mjs` → `public/textures/table/`): a 2× brush tile, the base and specular band, and the far-edge fade (the demo's mask ellipse as an overlay). The top light stays animated as a stretched baked blob with the demo's size, position and alpha. T stays at 4000, and frames match the live-CSS stills (`out/qa/cmp-baked.png`).
- **Gallery reference clips** could not be downloaded (github.io blocked by this environment's network policy); reference frames for review are rendered from the exact demo TSX instead (the same source the gallery clips were rendered from).

## Vertical cut (1080×1920)

The same timeline renders a 9:16 cut (`LtcgPromoVertical`; `src/fmt.tsx` supplies the frame size to every shot). Cuts, beats, motion timings and the SFX table are shared, so both cuts are identical in time and use the same audio. Only framing and overlay layout change:

| Shot | Vertical framing |
|---|---|
| S0 | flag mark stacked above a 118px wordmark; kicker typed on two lines |
| S1 | wide view starts lower on the page (cy 1200) so the tall frame is filled; close-up 1.75× (landscape 1.42×) so the card fills ~half the height; spotlight lock/push stations derived from the card's screen position |
| S2 | same orbit → pull-out → chase; runway less diagonal (rotZ −12°) and centred; title block under the board with a floor scrim |
| T1–T3 | 112px, wrapped inside 940px |
| S3 | wide window ≈1008px; crash lands at 1.28× (panel ≈1003px wide); after the hit the panel glides **up** (not left) and the "+60s" readout sits under it |
| S4 | the thread spans the frame width (zoom 1.04 → 1.08, same drift); caption in the band below |
| S5 | 1000px window at 1.0× over the same page band, so every bracket fires on the same frame (shared SCAN_FIRES / SFX); status row drops "PRE-GRADE" and the side Y readout |
| S6 | the nine cutouts in two clusters above and below a stacked lockup (flag over a 112px wordmark); description and URL under it |
| Captions | wrap inside 940px, bottom 250px (clear of feed UI) |

Text-size note (Q11): the chat thread is the one place the vertical cut is smaller than landscape (≈1.05× vs 1.5–1.62×), because the full thread width sets the zoom.
