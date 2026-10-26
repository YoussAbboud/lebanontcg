# Brag Plan: LebanonTCG

## What is this app?
LebanonTCG is Lebanon's peer-to-peer trading card marketplace: collectors list Pokémon, Magic, Yu-Gi-Oh! and One Piece cards, bid in live auctions, and settle every deal in chat — no checkout, no fees, no payments through the site. The impressive part is how much it does without ever touching money: live auctions with an anti-snipe clock, non-binding offers in a chat that IS the deal, and a Pre-Grade estimator that reads eight photos and tells you whether a raw card is worth sending to PSA.

## The angle
A card marketplace that refuses to be a shop. The video leans into the site's own line — **We connect collectors. You handle the deal.** — and shows the three things that make that true in practice: a live auction clock that extends when someone bids late, the chat where the winner and the seller sort it out themselves, and the Pre-Grade read that happens before a card is even listed. Neon acid on black, cards flipping into place, the clock ticking: a card-shop counter in Beirut after dark.

## Hook (first 2-3 seconds)
Five listing cards sweep into a fan, one by one, each with a card-flick sound landing on the beat; the centre one wears a **LIVE · 1D 15H** badge in acid. Over it, the site's eyebrow in mono caps: **LEBANON · PEER-TO-PEER**. No headline yet — the cards are the hook.

## Key moments (the middle)
- **The clock extends.** A live auction panel: `Current bid $250` → bids land `$280` → `$300` from different handles, the countdown reads 0:58 and jumps back to 1:58 on the late bid. Caption, verbatim from the Terms: *"A bid in the final minute extends the clock so nobody is sniped."*
- **The deal moves to chat.** The outcome line *Won at $300 by @karim_tcg*, then the thread: an acid bubble *"Deal at 300. Saturday afternoon somewhere near AUB?"*, a grey reply *"Caribou on Bliss street, 3pm?"*, and the **OFFER · NON-BINDING $300** card. Caption, verbatim from the hero: *"No checkout, no fees, you agree the terms yourselves."*
- **Pre-Grade.** The page's own question — **Is this card worth grading?** — with the eight capture slots filling one by one and the line *"Eight guided photos. A measured centering report, a defect read, an estimated PSA band with confidence."*

## Outro / punchline
Logo lockup **LEBANONTCG .** with the little flag-card, the footer line **We connect collectors. You handle the deal.**, and **www.lebanontcg.com** in mono. Music lands on the last strong cue and fades.

## User flow worth showing
Browse → open a live auction → bid (the clock extends) → win → the chat with the seller opens and the deal is agreed. That is the centrepiece (scenes 3–4). Pre-Grade (scene 5) is the pre-listing step a seller takes.

## Tone
- Preset: cinematic
- Creative direction: late-night card-shop energy — acid neon on near-black, cards flicking into place, a clock that will not sit still
- Interpretation: big display type and confident holds, but the energy comes from real UI moving (bids landing, the clock jumping, bubbles arriving) rather than from effects. No jokes written in; the only wink is the clock refusing to run out.

## Format: landscape — 1920x1080
## Duration: 20.5 seconds

## Visual identity (from the project)
- Background: #08090b (page) with the frame at #0e1013 and panels at #16191e
- Accent: #d6ff3f (acid); hero gradient #7b5cff → #35e4ff → #d6ff3f; pink #ff5c8a for danger/offers' edge
- Text: #f2f5f7 (primary), #b9c2cc (secondary), #7b8590 (muted); ink on acid #08090b
- Display font: Chakra Petch 700, uppercase, tracked (headlines, card titles)
- Body font: Inter 400/500; labels in JetBrains Mono 500 uppercase with 0.08em tracking
- Strongest visual element: the acid-outlined, glowing listing card (`.lcard.is-acid`) with its LIVE badge; the gradient "COLLECTORS" headline; the mono countdown

## Share copy (draft)
LebanonTCG. We connect collectors — you handle the deal. Lebanon's peer-to-peer card marketplace is live: list, bid, chat, no fees. www.lebanontcg.com

## Audio direction
- Role: warm rhythmic bed under a confident edit
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (114.84 BPM) — upbeat without being cute
- Music treatment: starts at 0 at ~0.8, ducks to ~0.6 under the chat scene so the bubble sounds read, swells back for the outro, fades out over the last 1.2s
- Music cue guidance: preset read from `assets/music/cues/…vol-9.music-cues.md`. Strong cues to target: **3.70s** (WE CONNECT slams), **10.54s** (Won at $300 line), **12.65s** (offer card lands); beat grid for sequential events: fan cards on 1.07 / 1.59 / 2.12 / 2.65 / 3.18; bids on 7.92 / 8.44 / 8.96; Pre-Grade slots on 15.28 / 15.81 / 16.34 / 16.86 (two slots per beat, accents only — no text on that grid)
- Audio-reactive treatment: subtle; music RMS/bass breathes the acid glow around the live card and the frame's violet halo. No waveform or equalizer visuals.
- SFX posture: moderate, motion-matched: casino card sounds for the fan, soft impacts for the headline, interface clicks for bids, a soft drop for each chat bubble, one deep bell for the logo
- Audio-coupled moments: fan cards (card-place on beat), WE CONNECT (impact), each bid (click + counter tick), clock extension (switch), chat bubbles (drop), Pre-Grade slots (light plate ticks), logo (bell ringing over the fade)
- Restraint rule: no sound on captions; never more than one SFX per beat; the bell is the only bell

## Storyboard

### Scene 1 — The fan — 3.4s (0.0–3.4)
Near-black frame with the site's violet top glow. Five listing cards (procedural "nebula + glyph" faces in the seed's hues — amber, crimson, violet, blue, orange) sweep in one by one into the home-page fan, the centre card largest and wearing an acid **LIVE · 1D 15H** badge with the title *Red-Eyes B. Dragon LOB 1st Edition* and *CURRENT BID $300*. Mono eyebrow **LEBANON · PEER-TO-PEER** fades in above.
Sequential/interaction: yes — cards arrive on beats 1.07, 1.59, 2.12, 2.65, 3.18; centre card last.
Audio intent: the sound of a deck being fanned on a counter; anticipation.
Audio-coupled idea: one casino card-place sound per card arrival.
Music: bed starts at 0.
Transition mood: hard → Scene 2

### Scene 2 — We connect collectors — 3.1s (3.4–6.5)
The fan drops to the lower third and dims. **WE CONNECT** slams in (Chakra Petch, white) beat-locked to 3.70; **COLLECTORS** follows in the hero gradient at 4.23. Sub-line in Inter, held: *"List what you own, message the person who has what you want."*
Sequential/interaction: two-line slam, then hold ≥1.8s.
Audio intent: the statement of intent; weight.
Audio-coupled idea: soft impact on WE CONNECT, lighter impact on COLLECTORS.
Transition mood: clean → Scene 3

### Scene 3 — The clock extends — 4.5s (6.5–11.0)
A live-auction panel from the Live Bid page, centred: title **VENUSAUR BASE SET SHADOWLESS**, **CURRENT BID $250**, **ENDS IN 0:58**, the acid-outlined card to its left. Bids land in a floating column at the panel's edge: `@nabil_pulls $250` (already there), then `@ritacollects $280` at 7.92, `@karim_tcg $300` at 8.44; the big figure ticks 250→280→300 with each. On the $300 bid the clock jumps **0:58 → 1:58** with an acid flash on the digits. Caption, held from 9.2: *"A bid in the final minute extends the clock so nobody is sniped."*
Sequential/interaction: yes — two bids arrive on the beat grid; the counter ticks; the clock extension is the payoff.
Audio intent: tension, then a small release when the clock jumps.
Audio-coupled idea: interface click + ticking counter per bid; a switch sound on the extension.
Transition mood: hard → Scene 4

### Scene 4 — The deal moves to chat — 4.5s (11.0–15.5)
Outcome line **Won at $300 by @karim_tcg** lands beat-locked at 10.54→ carried into 11.0 (ride the cue, hold until 12.0). Then the chat thread slides up: acid bubble *"Deal at 300 with the promos. Saturday afternoon somewhere near AUB?"* (11.6), grey bubble *"Saturday works. Caribou on Bliss street, 3pm?"* (12.1), and the **OFFER · NON-BINDING  $300** card beat-locked at 12.65. Caption from 13.4, held: *"No checkout, no fees, you agree the terms yourselves."*
Sequential/interaction: yes — two bubbles then the offer card; each is a text read, so they are spaced ≥0.5s and the full set holds ≥1.5s.
Audio intent: warmth; the human part.
Audio-coupled idea: soft drop per bubble; a slightly fuller drop on the offer card; music ducks under.
Transition mood: soft → Scene 5

### Scene 5 — Is this card worth grading? — 3.0s (15.5–18.5)
Dark panel. The page's heading **IS THIS CARD WORTH GRADING?** (Chakra Petch) with the eyebrow **PRE-GRADE · DECISION SUPPORT** in acid mono. Below, the eight capture slots (*Front · flat on, Back · flat on, Top-left corner …*) tick from empty to filled two at a time on 15.81 / 16.34 / 16.86 / 17.38. Line held from 16.4: *"Eight guided photos. A measured centering report, a defect read, an estimated PSA band with confidence."*
Sequential/interaction: yes — slot fills on the beat grid (accents, not text); the sentence is a single hold.
Audio intent: precision; quiet confidence.
Audio-coupled idea: light metal-plate tick per slot pair.
Transition mood: clean → Scene 6

### Scene 6 — Outro — 2.0s (18.5–20.5)
Logo lockup **LEBANONTCG .** with the flag-card glyph, scaled up at 18.44; beneath, **We connect collectors. You handle the deal.** in mono caps and **www.lebanontcg.com**. Music fades over the last 1.2s; the bell rings past it.
Sequential/interaction: none.
Audio intent: the landing.
Audio-coupled idea: one deep bell on the logo.
Music: fades out.

**Music mood for this video:** upbeat, confident
**Audio summary:** card flicks on the beat into a two-hit headline, clicks and a counter under the auction, a switch when the clock jumps, soft drops as the chat arrives with the bed ducked, plate ticks for the Pre-Grade slots, and a single bell over the fade.

## As built (final timing, 25.0s)
The readability check asked for longer holds, so the cut runs the full 25 seconds and every seam sits on a beat of the bed.
- 0.00–7.92 Fan + WE CONNECT / COLLECTORS (beat-locked 3.70 and 4.23; cards on 1.07 / 1.59 / 2.12 / 2.65 / 3.18)
- 7.92–13.18 Live auction: Umbreon VMAX Alt Art (the seeded live auction), bids $280 at 8.96 and $300 at 9.50, clock 51s → 1m 51s at 10.01 with the panel's own "+60s — bid in the final minute." line
- 13.18–19.48 Chat: "Won at $300" beat-locked at 13.18, the seeded thread with @karim_tcg (messages 13.70 / 14.76, offer card 15.81), home-page line from 16.34
- 19.48–22.12 Pre-Grade: heading + "Eight guided photos." (the lede was cut to a line that can be read in the time), slots fill in pairs on 20.02 / 20.54 / 21.06 / 21.59
- 22.12–25.00 Outro: logo + bell, footer line and URL held 2.6s
- Poster / frame 0: 6.0s (headline settled over the fan)
