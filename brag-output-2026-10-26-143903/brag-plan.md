# Brag Plan: LebanonTCG (square)

## What it is
Lebanon's peer-to-peer trading card marketplace: collectors list cards, bid in live auctions and settle every deal in chat. There's no checkout and no fees, and no payment ever runs through the site.

## Who it's for, and what sets it apart
It's for card collectors in Lebanon who trade Pokémon, Magic, Yu-Gi-Oh! and One Piece. The site connects people and steps aside: bids aren't binding, and winning just opens a chat with the seller. The anti-snipe clock and Pre-Grade show it was built by people who trade cards.

## Most impressive claim
"A bid in the final minute extends the clock so nobody is sniped." (from the Terms; the auction panel prints "+60s — bid in the final minute.")

## Hook
At frame 0 a pile of listing cards sits under the acid-outlined live card with its **LIVE · 1D 15H** badge. On the beat, the cards deal out into the home-page fan.

## Angle
The site's own line: **We connect collectors. You handle the deal.** The video shows a buyer's path, built for a square feed post: the fan, a live auction whose clock jumps on a late bid, the chat where the deal happens, then Pre-Grade.

## Tone
Cinematic, for a square feed: big type, neon acid on near-black, and the UI doing the moving. Each scene holds its text long enough to read.

## Format
Square 1080×1080, 30 fps, 22.5 s. Key text stays inside the 80% title-safe box (108–972 px). Same story, timing and soundtrack as the vertical cut (brag-output-2026-10-26-142714); only the layout changes. The fan bleeds off the bottom edge under the headline. In the chat, the thread scrolls up when the offer card arrives, as a real chat does, so the square frame keeps the type large.

## Visual identity (from src/styles/tokens.css and the components)
- Ground #08090b / #0b0c10, panels #16191e, hairlines rgba(255,255,255,.08)
- Text #f2f5f7 / #b9c2cc; acid #d6ff3f; hero gradient #7b5cff → #35e4ff → #d6ff3f; presence green #34d399; decline pink #ff5c8a
- Chakra Petch 700 for display, Inter for body, JetBrains Mono uppercase labels. These are the project's own @fontsource files.
- Real assets: the flag logo (first frame of src/assets/flag.gif). The listing cards, auction panel, chat bubbles, offer card and Pre-Grade slots are rebuilt from the components' CSS, because the live app's clocks and realtime state aren't frame-deterministic.
- Data on screen comes from the mock seed (handles like @karim_tcg and @linacollects are fictional seed users), so no real user appears.

## Soundtrack
One synthesized piece in A minor at 120 BPM (a beat is 0.5 s, a bar 2 s), with an Am–F–C–G progression. Every cut and effect sits on that grid.
- 0–4 s intro: pad, soft hats and a half-time kick; a muted card flick on each card deal; a riser into the drop
- 4 s drop on WE CONNECT: full groove with four-on-the-floor kick, off-beat bass, claps and a pluck arpeggio
- 12–18 s chat: the drums pull back and the message "bloops" are pitched to chord tones
- 18–20 s Pre-Grade: slot ticks are plucks on A–C–F–A, the F chord under that bar
- 20 s logo: the final Am chord and one bell ring out to the end

## Storyboard (each cut lands on a beat)
| # | Scene | Time | On screen |
|---|---|---|---|
| 1 | Hook: the deal | 0.0–4.0 | Eyebrow LEBANON · PEER-TO-PEER; the pile deals into the fan on 1.0 / 1.5 / 2.0 / 2.5; the live card lifts on 3.0 |
| 2 | Reveal | 4.0–8.0 | WE CONNECT (4.0, the drop) / COLLECTORS (4.5) in the hero gradient; "List what you own, message the person who has what you want." held from 5.0. The fan sinks to the bottom and dims |
| 3 | The clock extends | 8.0–12.0 | Umbreon VMAX Alt Art live auction. The caption "A bid in the final minute extends the clock so nobody is sniped." appears at 8.5. Bids from @ritacollects ($280) at 9.0 and @karim_tcg ($300) at 9.5; the clock jumps 51s → 1m 51s at 10.0 with "+60s — bid in the final minute." |
| 4 | The deal moves to chat | 12.0–18.0 | WON AT $300 (12.0); the seeded thread at 12.5 and 13.5; the OFFER · NON-BINDING $300 card at 14.5; "No checkout, no fees, you agree the terms yourselves." held from 15.0 |
| 5 | Pre-Grade | 18.0–20.0 | IS THIS CARD WORTH GRADING? and "Eight guided photos."; the eight slots fill in pairs on 18.5 / 18.75 / 19.0 / 19.25 |
| 6 | Outro | 20.0–22.5 | Flag + LEBANONTCG. on the final chord; "We connect collectors. You handle the deal." and www.lebanontcg.com held for 2.3 s |

Transitions: the pile deals into the fan; the fan sinks under the headline; vertical whips (up and out, up and in) between the reveal, auction, chat and Pre-Grade; a blur swap into the logo.

## Share caption
LebanonTCG: Lebanon's peer-to-peer card marketplace. List what you own, bid in live auctions where a last-minute bid extends the clock, and close the deal in chat. No checkout, no fees. www.lebanontcg.com

## As built
- The check passed with zero errors. Three craft warnings were weighed and kept:
  - The background card's pill and the auction eyebrow render at 24–26 px.
  - The first chat bubble scrolls away after about 2 s, while the offer card takes its place.
- Contrast passed 36/36.
- The soundtrack is the same synthesized piece as the vertical cut (work/synth.py), at about −14 LUFS.
- The poster and frame 0 come from 6.0 s: the headline over the fan.
