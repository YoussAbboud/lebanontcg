# Brag Plan: LebanonTCG — two phones, one deal (vertical)

## What it is
Lebanon's peer-to-peer trading card marketplace. You find a card, talk to the seller in chat, and meet in person to trade. There's no checkout and no fees.

## Who it's for, and what it does for them
It's for collectors in Lebanon buying and selling Pokémon, Magic, Yu-Gi-Oh!, One Piece and Lorcana. Chat has three tools that take a deal from "still available?" to a meetup:
- a non-binding **offer**, which the other side accepts with one tap;
- your **phone number**, which they can call or WhatsApp straight from the card;
- a **meeting place**, picked on a map and opened in Google Maps or Waze.

## What sets it apart
The deal happens in person, and the site gives both people exactly what they need to meet. It is a two-sided handshake, so this cut shows **both sides at once**.

## Most impressive claim
Every tap on one phone lands on the other a beat later: the offer arrives ready to accept, the number arrives ready to call, and the spot arrives ready to navigate.

## Angle (different from the earlier cuts)
- **Earlier cuts:** one phone with feature captions beside it.
- **This cut:** a **split screen of both phones**. The buyer (@ritacollects) is on top and the seller (@mayapulls) on the bottom, joined by a lime seam band that names each step. A fingertip does the tapping, and each action visibly arrives on the other phone.
- **Bookends:** a full-bleed acid-lime card whose type splits open to reveal the phones; at the end the halves close back into lime for "See you at Zaitunay Bay."

## Tone
Bold and kinetic: big black-on-lime type for the bookends, and real UI in the middle. It sits closest to `default`/`cinematic`, with a playful rhythm.

## Format
Vertical 1080×1920, 30 fps, about 24.6 s (46 beats at 112 BPM). Key text stays inside the 80% title-safe box. The top 140 px and bottom 170 px stay quiet for the Reels/TikTok overlays.

## Visual identity
- **Colours:** inverted bookends, with acid #d6ff3f full-bleed and #08090b type. The middle uses the app's dark UI (#0e1013 halves, #16191e panels, acid accents).
- **Fonts:** Chakra Petch 700 for display, Inter for body, JetBrains Mono for labels. These are the project's own @fontsource files.
- **UI rebuilt from the chat CSS:**
  - bubbles, the offer bar and offer card with Accept / Decline;
  - the phone bar with the Lebanese flag picker (flag-icons SVG);
  - the phone card with CALL / WHATSAPP buttons;
  - the location bar with "Use my current location" / "Choose on the map";
  - the map picker and the location card with GOOGLE MAPS / WAZE.
- **Map:** the same illustrative Beirut waterfront in OpenStreetMap's palette as the earlier cuts. OSM tiles can't be fetched here, so it carries no OSM credit.
- **People and number:** fictional demo users and an obvious placeholder number, +961 70 000 000.

## Soundtrack (new, synthesized: work/synth.py)
- **Style:** amapiano-flavoured, E minor, 112 BPM (a beat is 0.5357 s).
- **Harmony:** Em9 – Am9 – Dmaj9 – Cmaj7.
- **Instruments:** a pitched log-drum bass, a kick on every beat, shaker sixteenths, a clap on 2 and 4, jazzy piano stabs on the off-beats, a soft pad.
- **Effects on the same grid, pitched to the chord:**
  - hits on the hook's three words, and a whoosh as the lime splits;
  - a soft "send" lift when something leaves one phone, and a "pop" when it lands on the other;
  - a tap click for every finger press, and ticks for typed digits;
  - a two-note chime on "accepted";
  - a thump when the pin drops;
  - a bell chord with the logo.
- **Bookends:** the drums drop out for "See you at Zaitunay Bay"; the final chord rings under the logo.

## Storyboard (beats at 112 BPM; t = beat × 0.5357 s)
| # | Scene | Beats (s) | On screen |
|---|---|---|---|
| 1 | Hook | 0–7 (0–3.75) | Full-bleed lime. **TWO COLLECTORS.** (0), **ONE CHAT.** (2), **ONE MEETUP.** (4) in black, stacked across the middle. At 6 the lime splits along the middle line, cutting "ONE CHAT." in two, and slides apart to reveal both phones. The seam band lands at 7: "BUYER ↑ · ↓ SELLER" |
| 2 | Offer | 8–18 (4.3–9.6) | Seam: **01 · OFFER**. Top (buyer): the seller's message, then the offer bar types $290 + "Cash, this weekend?"; sent at 11. Bottom (seller): the offer card lands at 11.5 with ACCEPT / DECLINE. The finger taps ACCEPT at 13, and both phones show "Offer accepted" (13.5) and the system pill (14). Seam swaps to **ACCEPTED ✓** at 13.5 |
| 3 | Number | 18–26 (9.6–13.9) | Seam: **02 · NUMBER**. Bottom (seller): the phone bar with the flag picker types 70 000 000 (19–20.75); SHARE at 21. Top (buyer): the number card lands at 21.5 with CALL / WHATSAPP; the finger taps WHATSAPP at 23. Seam: **CALL OR WHATSAPP** at 23 |
| 4 | Meetup | 26–36 (13.9–19.3) | Seam: **03 · MEETUP**. Top (buyer): the location bar's two options; a tap on "Choose on the map" at 27. The map fills the top phone at 28 and pans under the pin until the pin drops at 30; "Use this spot" at 31. Bottom (seller): the location card lands at 32 with the map preview, Zaitunay Bay, GOOGLE MAPS / WAZE. Seam: **OPENS IN MAPS & WAZE** at 33 |
| 5 | Outro | 36–46 (19.3–24.6) | At 36 the lime halves close over the phones, with **SEE YOU AT / ZAITUNAY BAY.** and a pin (held to 40). At 40 the lockup: flag + **LEBANONTCG.**, "We connect collectors. You handle the deal." and www.lebanontcg.com, held 3.2 s |

## Share caption
Both sides of a LebanonTCG deal, one chat: make an offer, share your number, pick a public spot on the map, and meet. No checkout, no fees. www.lebanontcg.com
