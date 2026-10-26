# Hyperframes Composition Brief: LebanonTCG

## Objective
Create a short launch-style brag video for LebanonTCG, Lebanon's peer-to-peer trading card marketplace.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20.5 seconds

## Source Material
- Project root: /home/user/lebanontcg
- Primary files read: index.html, src/pages/HomePage.tsx, src/pages/ListingPage.tsx (live bid panel), src/pages/ChatPage.tsx, src/pages/PregradePage.tsx, src/pages/TermsPage.tsx, src/components/AppShell.tsx, src/styles/tokens.css, src/mock/seed.ts
- Product name: LebanonTCG
- Tagline / strongest claim: "We connect collectors. You handle the deal."
- Key UI to recreate: the acid-outlined listing card with LIVE badge, the live-auction bid panel with mono countdown, the chat thread with the non-binding offer card, the Pre-Grade eight capture slots
- Copy that must appear verbatim:
  - LEBANON · PEER-TO-PEER
  - WE CONNECT / COLLECTORS
  - List what you own, message the person who has what you want.
  - A bid in the final minute extends the clock so nobody is sniped.
  - No checkout, no fees, you agree the terms yourselves.
  - Is this card worth grading?
  - Eight guided photos. A measured centering report, a defect read, an estimated PSA band with confidence.
  - We connect collectors. You handle the deal.
  - www.lebanontcg.com

## Creative Direction
- Tone preset: cinematic
- Creative direction: late-night card-shop energy — acid neon on near-black, cards flicking into place, a clock that will not sit still
- Interpretation: big display type, confident holds; energy from real UI moving (bids landing, clock jumping, bubbles arriving), not from effects
- Angle: a card marketplace that refuses to be a shop. Show the three things that make "We connect collectors. You handle the deal." true: the anti-snipe auction clock, the chat where the deal happens, and Pre-Grade before listing.
- Hook: five listing cards sweep into a fan on the beat, centre one wears an acid LIVE · 1D 15H badge
- Outro / punchline: LEBANONTCG logo lockup + "We connect collectors. You handle the deal." + www.lebanontcg.com
- Avoid: generic SaaS language, abstract filler, unrelated redesign, any claim about payments through the site

## Visual Identity
- Background: #08090b, frame #0e1013, panels #16191e, borders rgba(255,255,255,.08)
- Text: #f2f5f7 / #b9c2cc / #7b8590
- Accent: #d6ff3f (acid), hero gradient #7b5cff → #35e4ff → #d6ff3f, pink #ff5c8a
- Display font: Chakra Petch 700 (local woff2 from @fontsource)
- Body font: Inter 400/500; labels JetBrains Mono 500 uppercase, 0.08em tracking
- References: `.lcard.is-acid` glow card, gradient COLLECTORS headline, mono countdown, chat bubbles (acid = mine, surface = theirs)

## Storyboard
The storyboard in `brag-output/brag-plan.md` is the creative contract.
1. The fan — 3.4s — five cards on the beat, LIVE badge, eyebrow
2. We connect collectors — 3.1s — two-line slam (beat-locked 3.70), sub-line held
3. The clock extends — 4.5s — bids $280, $300; 0:58 → 1:58; anti-snipe caption
4. The deal moves to chat — 4.5s — Won at $300 (cue 10.54), two bubbles, offer card (cue 12.65), no-fees caption
5. Pre-Grade — 3.0s — heading, eight slots filling, line held
6. Outro — 2.0s — logo, footer line, URL

## Audio
- Audio role: warm rhythmic bed under a confident edit
- Audio arc: bed in from 0, ducks under chat, swells for outro, fades over last 1.2s, bell rings past it
- Music: happy-beats-business-moves-vol-9-by-ende-dot-app.mp3
- Music treatment: volume ~0.8, ~0.55 under scene 4, fade-out 1.2s
- Music cue guidance: `.claude/skills/brag/assets/music/cues/` vol-9 preset; strong cues 3.70 / 10.54 / 12.65; beats 1.07 1.59 2.12 2.65 3.18 … 7.92 8.44 8.96 … 15.81 16.34 16.86 17.38 18.44
- Audio-reactive treatment: subtle — RMS breathes the acid glow on the live card and the violet top halo
- Audio-coupled moments: fan cards (card place), headline (impact), bids (click), clock extension (switch), bubbles (drop), slots (tick), logo (bell)
- SFX analysis guidance: `.claude/skills/brag/assets/sfx/sfx-analysis.md`; prefer low high-frequency-risk files for repeats
- Exact SFX choice: chosen at composition time; copied into `brag-output/composition/assets/sfx/`
