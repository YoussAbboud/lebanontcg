# Review inputs — LebanonTCG promo (video-shotcraft, autonomous creation mode)

Everything below is the production basis. Paths are relative to `/home/user/lebanontcg/shotcraft-promo` unless absolute.
Skill root: `/home/user/lebanontcg/.agents/skills/video-shotcraft` (= `$SK`).

## Deliverables under review
- `out/promo.mp4`: with BGM. `out/promo-nobgm.mp4`: same timeline, SFX only.
- Key frames: `review/frames/f<frame>.png` (8 per shot, evenly spaced from in to out, plus 552/553, 1133/1134, 1219) and `review/sheets/<shot>.png` (contact sheets per shot, frame numbers burned in). Extract any other frame from `out/promo.mp4` with ffmpeg as needed.
- Delivery audio path and measurements: `render.sh`, `analysis/av_offset.json`, `analysis/av_backtest.json`, `analysis/sfx_peaks.json`.
- Reference renders: `review/ref/<card>.mp4` (half scale, full demo length), `review/ref/<card>/f<NNN>.png` and `review/ref/<card>-sheet.png`, all rendered from the **exact demo TSX** of each card with the demo's own textures. The Gallery reference clips (github.io) are unreachable from this environment, so no Gallery clip is available.

## Basis documents
- Production spec, stages 0–3 (inlined below).
- Final storyboard, as built (below).
- Card docs: `$SK/references/shots/<category>/<card>.md`; demo TSX: `$SK/demos/<category>/<card>/*.tsx`; index: `$SK/gallery/api/library.json` (cards: brand-ink-open, spotlight-hero-card, deck-deal-flyin, paper-title-card, crash-zoom-punch, row-embed, scanline-annotate-focus, outro-group-photo-launch; no style variant was named by the user).
- Checklists: `$SK/references/final-review.md`, `$SK/references/aesthetic-rules.md`; audio: `$SK/references/sound-design.md`, `$SK/references/music-beat-sync.md`.
- Shot source: `src/shots/*.tsx`, timing `src/timing.ts`, SFX pin table `src/Sound.tsx` (pin = target peak frame; `from` compensates the file's measured peak lag, `analysis/sfx_peaks.json`).
- Beat analysis: `analysis/beat_data.json`. Output A/V offset measurement: `analysis/av_offset.json`. Post-render beat back-test: `analysis/av_backtest.json`.
- Data: every page is a capture of the project's offline mock build; all handles, listings, prices and messages are fictional seed data (`/home/user/lebanontcg/src/mock/seed.ts`). Capture script: `capture/capture.mjs`.

---

# LebanonTCG — video-shotcraft design spec (autonomous mode)

Mode: autonomous creation (`references/pipeline.md`), chosen by the user. Stages 0–3 below are the agent-recorded production basis.

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

---

## Final storyboard (as built)

Frames: cut at beatF(n) = round((0.014 + n·60/123.992)·30) → 0, 117, 291, 465, 523, 668, 726, 842, 900, 1046; end 1220 (40.7 s). Slams: frame 552 (b38), frame 1133 (b78).

| Shot | Frames | On-screen copy |
|---|---|---|
| S0 Brand open | 0–116 | LEBANONTCG. · WE CONNECT COLLECTORS. YOU HANDLE THE DEAL. |
| S1 The listing | 117–290 | note: "List what / *you own.*" |
| S2 The deal | 291–464 | counter "NN CARDS LISTED" · "Listed by / *collectors.*" · "Pokémon, Magic, Yu-Gi-Oh! and One Piece." |
| T1 | 465–522 | Live auctions. Nobody gets *sniped.* |
| S3 Anti-snipe | 523–667 | crash target: the whole auction panel (late bid captured: "+60s — bid in the final minute.") · readout: the Terms sentence on three lines |
| T2 | 668–725 | Winning opens a *chat* with the seller. |
| S4 Chat | 726–841 | five rows (last five bubbles of the seeded thread, ending on the offer card) · caption: No checkout, no fees, you agree the terms yourselves. |
| T3 | 842–899 | *Pre-Grade* before you list. |
| S5 Pre-Grade | 900–1045 | real Pre-Grade page (slots empty); each slot gets corners + label (CENTERING / CORNER / SURFACE …); status ends on "EIGHT GUIDED PHOTOS" · caption: A centering report, a defect read, an estimated PSA band. |
| S6 Finale | 1046–1219 | flying elements + wordmark stamp at frame 1133 · eyebrow + www.lebanontcg.com |

Other recorded production facts:
- S2: the demo's graphite table (CSS gradients + feTurbulence) is pre-rendered once to textures by `capture/bake-table.mjs`, same CSS and layer order; only the top light is animated.
- S5: machine colour cyan; window scaled 0.86, page 1.143× inside.
