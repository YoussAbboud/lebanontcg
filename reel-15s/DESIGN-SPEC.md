# LebanonTCG — 15s Instagram Reel · video-shotcraft design spec (autonomous free-creation mode)

Mode: **autonomous free creation** (`references/pipeline.md`), as requested. Stages 0–3 below were decided by the agent and recorded here; no approval stops.

## Stage 0 — Brief

- **Product:** LebanonTCG (www.lebanontcg.com), Lebanon's peer-to-peer trading-card marketplace. Collectors list Pokémon, Magic, Yu-Gi-Oh! and One Piece cards, bid in live auctions and agree the deal in chat.
- **Deliverable:** a 15 s Instagram Reel advertisement, 1080×1920 (9:16), 30 fps (450 frames), plus this editable Remotion project.
- **Requested arc:** an opening where trading cards enter through smooth 3D motion; a middle that reveals the marketplace and shows card browsing; an end with the logo, "Buy. Sell. Trade." and lebanontcg.com.
- **Requested style:** premium, minimalist, modern trading-card advertising. Clean typography, minimal text, polished transitions, subtle SFX, rhythmic music. **Banned:** generic AI imagery, excessive glows, random gradients, fake website interfaces and decorative clutter.
- **Brand colours (given):** dark gray `#2a2f38` and neon green `#d3fc3b`.

### Requirement → execution decisions

| Requirement | Decision |
|---|---|
| Actual website screenshots | Real pages of the site, rendered from this repository's own build (the code deployed to lebanontcg.com), in its **mobile layout** (390 px viewport at 3–4×), so 9:16 frames are the site edge to edge with no device mock-up. The live domain is unreachable from this build environment (egress policy, HTTP 403), so the offline mock build provides the data: every handle, listing, bid and price is fictional seed data. `capture/capture.mjs` takes `BASE=https://www.lebanontcg.com` to re-capture from the live site with the same selectors. |
| Authentic Pokémon / Yu-Gi-Oh! / MTG imagery "where properly licensed" | **None is used: no licence is held.** Official card art is copyrighted by The Pokémon Company/Nintendo, Konami and Wizards of the Coast, and an ad is a commercial use. The cards on screen are the site's own listing cards with the site's placeholder art. Game names appear only as the listings' own text (nominative use, as on the site). Once licensed photos exist on real listings, re-capturing from the live site puts them in the film unchanged. |
| Real brand assets | `public/favicon.svg`: the gold-framed flag-card mark (the same mark as the site's spinning `logo.gif`). The site's wordmark is "LEBANONTCG." in Chakra Petch with an accent dot. Brand fonts: Chakra Petch, Inter, JetBrains Mono (the site's own). |
| Brand colours | Stage ground = flat `#2a2f38` (no gradients). `#d3fc3b` is the **only** accent: the period dots, the URL and the brake highlight. Text is `#f2f5f7`. The site's own UI keeps its own colours inside the screenshots. |
| Music | `house-vibez.mp3` (Lily J, Mixkit Stock Music Free License, traced URL in the skill's `assets/audio/ATTRIBUTION.md`), 122.0 BPM. The window is 59.07 s → 74.07 s of the track (beat 120 = film beat 0): 8 calmer beats for the opening, then the drop at film beat 8. Delivered with and without BGM. |
| SFX | Subtle real-object sounds only, all with traced Mixkit sources (paper, switch, typewriter, soft swooshes). No synthetic UI tones and no big impacts. |
| Length / rhythm | 450 f. Every cut and key action sits on the fitted beat grid `beatF(n) = round((0.0179 + n·0.491796)·30)`. |
| Text | Minimal: only the end card (wordmark, "BUY. SELL. TRADE.", URL). Everything else is the site's own UI. |

## Stage 1 — Visual direction

Three directions considered:
1. **Graphite card studio (chosen).** A flat `#2a2f38` stage lit only by the cards themselves. Real listing cards and real pages are the only imagery, with one neon accent. Energy: medium (calm opening → drop → precise), tone: premium/serious. It fits "premium, minimalist" and keeps every pixel on screen product-real.
2. Neon arena (dark + green glows, particles). Rejected: the brief bans excessive glows and decoration.
3. Paper/collector's binder (warm, textured). Rejected: off-brand; the site is a dark neon UI.

**Styleframe: skipped, with reason.** The look is fixed by the client's two colours plus the site's real screenshots and fonts. There is no invented element whose look needs approving. Every on-screen surface is either a capture or flat `#2a2f38` with brand type.

Tokens:

| Token | Value |
|---|---|
| Stage | `#2a2f38` flat; card contact shadows `rgba(0,0,0,0.45)` only |
| Accent | `#d3fc3b` (single accent) |
| Text | `#f2f5f7` |
| Display | Chakra Petch 700, uppercase (site display face) |
| Mono | JetBrains Mono 500–700 (URL) |
| Motion | smooth 3D (Catmull-Rom splines), long-tail braking, springs only on the logo bloom; no blur on the tumbling cards; speed blur only on the fast scroll |

## Stage 2 — Feature → shot mapping

| Brief beat | Card (style) | Why | Backup |
|---|---|---|---|
| Opening: cards enter in smooth 3D | `card-flock-tumble` (tumble + idle drift only) | three real listing cards (one Pokémon, one Yu-Gi-Oh!, one Magic) tumble from edge-on into a 3D staircase on one continuous spline, never stopping. The card's smoke ring / flash / giant type are **not used** (glows and decoration are banned) | `card-stack` |
| Reveal the marketplace | `shot-transitions` C (portal / mask-wipe) | the front card becomes the window into the real Browse page, where the same card is the first listing | `crane-rise-reveal` |
| Demonstrate browsing | `scroll-brake-moves` A (changelog-scroll-brake) | the real Browse feed scrolls fast and brakes exactly on a live auction; the card lifts, a tap opens it | `type-and-filter` |
| Open a listing | shared-element card-art morph (Browse card art → listing photo), then a slow read of the real listing page | the native-app idiom for "tap to open"; it carries the same card across the cut | `shot-transitions` A |
| Logo, "Buy. Sell. Trade.", URL | `ui-to-brand-morph` A (icon-flip-bloom) | the trading card the viewer just opened flips flat and blooms into the flag-card logo, which is itself a trading card (the site's logo spins the same way). Then the wordmark, three words on three beats, and the URL | `logo-shrink-wordmark-lockup` |

Each technique is the hero exactly once.

## Stage 3 — Storyboard (beat-locked, 450 f)

Beat frames: b0 1 · b3 45 · b4 60 · b8 119 · b12 178 · b13 192 · b14 207 · b17 251 · b21 310 · b23 340 · b25 369 · b26 384 · b27 399 · b28 414.

| # | Frames | Beats | Shot | Action | On-screen text | SFX |
|---|---|---|---|---|---|---|
| S1 | 0–119 | b0–b8 | Opening | Three real listing cards (Ragavan · Red-Eyes B. Dragon · Venusaur, back→front) tumble from edge-on into an overlapping 3D staircase on one spline (−6→45, pre-rolled so frame 0 already shows the cards; out-cubic, lands b3), then drift slowly (never still). 67–79 the front card (Venusaur) turns flat and lifts; 79–119 it opens as a window and the real Browse page grows inside, completing on the drop (b8) | none | paper slide on the flight, paper move on the landing, soft sweep into the drop |
| S2 | 119–251 | b8–b17 | Browse | Real mobile Browse page; 23 f hold on the top ("BROWSE CARDS · 42 RESULTS"); 142–192 the feed scrolls ~4,300 CSS px and brakes on the live Umbreon auction (stop on b13), with speed blur only while fast. 192–206 the card lifts (1.03×, `#d3fc3b` 2 px outline) while the others dim to 0.38; b14 (207) tap; 221–251 its card art grows into the listing photo, landing on b17 | none (site UI only) | paper paging under the scroll, soft lock on the brake, switch tap, small swoosh into the listing |
| S3 | 251–310 | b17–b21 | Listing | Real listing page (live auction, $304, 3 bids, ends in 3m): the camera glides from the photo to the bid panel (251–280) and holds (≥30 f) | none (site UI only) | (music) |
| S4 | 310–450 | b21–end | End card | The page dissolves to `#2a2f38` as the listing's card floats to centre (310–328) with an anticipation wiggle. It flips flat (328–340, thinnest on b23) and blooms into the flag-card logo (spring). The logo rises; "LEBANONTCG." sets letter by letter (344–370). **BUY.** b25 · **SELL.** b26 · **TRADE.** b27 (accent periods). **lebanontcg.com** b28 (414). A 36 f sign-off hold with a 1.5% push | LEBANONTCG. · BUY. SELL. TRADE. · lebanontcg.com | swish on the flip, soft hit on the bloom, a typewriter tap per word, a click on the URL |

Brand hold: the logo + wordmark are fully set from 370 to 450 (80 f ≥ 30 f, R1); the URL holds 36 f. Whole-frame shocks: 0 (the drop is carried by the reveal, not a flash).

## As built (after the independent review)

Changes from the storyboard above, with reasons:

- **Opening cards are trading-card objects.** Each listing's own card-shaped photo (Venusaur · Dark Magician · Grief), not the full listing tiles. The brief's "trading cards enter the frame" needs card objects. The stack sits ~120 px above centre, clear of Instagram's caption overlay.
- **Portal coverage.** The page inside the window starts at max(card/frame) ≈ 0.66, not the demo's 0.42. The vertical window starts at the card's full size, so 0.42 left it part-empty: the back cards showed through and the page's square corners were visible.
- **Browse target.** Red-Eyes B. Dragon (a different seller and colour from the first card), ~2 frame heights down, not the far-down Umbreon auction. The old target looked like the first card again, and the 6-frame-height run was an unreadable smear. Timeline: hold 119–149 (30 f after the portal), scroll 149–199 (stops off-beat by design so the hold is ≥30 f), lift 199–213, tap on b15 (222), open 224–251.
- **Shared-element open.** It flies the card's own art crop (`target-face-3x.png`). The Browse page fades to the page ground first, and the listing page arrives only once the art is over its photo slot, so nothing crosses the flying art.
- **Stop highlight and tap.** The accent outline is offset 6 px on a dark rim (a 2 px lime-on-lime outline didn't read). The tap ring has a dark rim and a white core.
- **Listing.** The glide is 251–279 and the hold ≥31 f. The end scroll is derived from the bid panel's position.
- **End card re-time.**
  - Flight 310–324.
  - Anticipation 323–343 (no longer overlapping the flight).
  - Flip thinnest on b24 (355).
  - Settle 360–378, in-out (no velocity jump).
  - Wordmark letters 362–396 at the card's 2.4 f stagger.
  - BUY. b27 (399) · SELL. half-beat (406) · TRADE. b28 (414), all only after the wordmark has set.
  - lebanontcg.com at 421, 84 px (the slogan's size), holding 29 f.
  - The ending is deliberately calm: a premium sign-off on the groove, not the film's energy peak.
- **Header captures.** The mock-only user switcher is removed from layout (`display: none`), so the search button no longer overlaps the wordmark. The header's animated logo is pinned to its own face-on first frame (`capture/logo-frame0.png`, frame 0 of `src/assets/flag.gif`).
- **Audio.**
  - BGM 0.38 (from 0.5). It is ducked ~5 dB under the portal sweep, the paging bed and the open swoosh, and ~2.5 dB under the tagline keys (they land on kick beats).
  - The paging bed is `paper-browse-bed.mp3`: the traced `paper-book-browse-fast.mp3` trimmed to 1.533–3.267 s and normalised to −2.9 dBFS.
  - SELL uses `typewriter-hit-hard` (traced) between two soft keys.
  - Every effect measured on the PCM stems clears the BGM in at least one band (`analysis/` measurement notes in the review record). Mix peak −3.2 dBFS.
- **A/V.** Output offset 0.0 f; BGM lag −0.33 ms; every cut/event within 0.43 f of its beat (`analysis/av_offset.json`, `analysis/av_backtest.json`).
- **Imagery licence.** Unchanged and open: no official card art is used (no licence held). The cards show the site's placeholder art. This is flagged to the client; licensed or seller-permitted listing photos can be dropped in by re-capturing from the live site.
