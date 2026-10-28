# Brag Plan: LebanonTCG — the whole deal, in chat

## What it is
Lebanon's peer-to-peer trading card marketplace. You find a card, talk to the seller in chat, and meet in person to trade. There's no checkout and no fees.

## Who it's for, and what it does for them
It's for collectors in Lebanon buying and selling Pokémon, Magic, Yu-Gi-Oh!, One Piece and Lorcana. Chat now has three tools, and together they take a deal from "still available?" to a handshake:
- **$** makes a non-binding offer.
- **☎** shares your phone number, with a country-code picker and flag.
- **Pin** shares a meeting place, from your current location or a spot chosen on the map.

## What sets it apart
The deal really happens in person. The site doesn't pretend to be a checkout: it gives you exactly what you need to meet, which is a price you both agreed, a way to reach each other and a public place. Phone numbers and locations stay inside that one chat and are never added to anyone's profile.

## The most impressive claim
From "is it still available?" to a meetup at Zaitunay Bay in three taps: $, ☎, pin.

## Hook (0–4 s)
The real chat composer at hero size: **$**, **☎**, **pin**, "Write a message", SEND. On three beats each tool lights up as a word slams in above it: **OFFER.** **NUMBER.** **MEETUP.** Then the line: "Set up the whole deal in chat."

## Angle
Show one real deal end to end, from the buyer's side, on the demo listing **Charizard Base Set Unlimited** (asking $320; its description says "Price slightly negotiable for quick pickup."). Each feature gets one beat-locked scene, using the real UI, copy and colours.

## Tone
`app-store`, pushed punchy: clean feature scenes, smooth slides, lime-on-black, one idea per scene, and big type you can read on a phone.

## Format
Landscape 1920×1080, 30 fps, 21.0 s. Key text stays inside the 80% title-safe box.

## Visual identity (from src/styles/tokens.css and the chat components)
- **Colours:**
  - ground #08090b / #0b0c10, panels #16191e;
  - text #f2f5f7 / #b9c2cc / muted #7b8590;
  - acid #d6ff3f; presence green #34d399.
- **Fonts:** Chakra Petch 700 (display, uppercase), Inter (body), JetBrains Mono (uppercase labels). These are the project's own @fontsource files.
- **Rebuilt from the components' CSS:**
  - chat bubbles, the offer bar and offer card;
  - the phone bar with the CountryCodePicker button;
  - the phone card, the location bar's two buttons, the map picker and the location card.
- **Flag:** the Lebanese flag is the flag-icons SVG the app ships.
- **People:** fictional demo users from the mock seed, @mayapulls (seller) and @ritacollects (buyer).
- **Phone number:** an obvious placeholder, +961 70 000 000, so no real person's number appears in a public video.
- **Place:** Zaitunay Bay, Beirut, a public waterfront.
- **Map:** OpenStreetMap tiles can't be fetched from the build machine, so the map is a simplified drawing of the Beirut waterfront in OSM's own palette (land #f2efe9, sea #aad3df, roads #fcd6a4 / white). It's labelled as illustrative here and carries no OSM credit, since it isn't OSM data.

## Soundtrack
One synthesized piece, the house sound from the square cut, in A minor at 120 BPM: a beat is 0.5 s and a bar 2 s, over an Am–F–C–G progression. Effects are pitched to the chord they land on and sit under the music.
- **0–4 s intro:** a pad and soft hats; three plucks on OFFER/NUMBER/MEETUP (A, C, E); a riser into the drop.
- **4 s drop:** the groove comes in. The offer card lands with a G-chord pluck, and "accepted" gets a bright two-note chime.
- **9–13 s phone:** the drums pull back. Each typed digit group is a soft tick on the eighths, and the shared card gets a C-major pluck.
- **13–18 s map:** the pin drop is a soft low "boom" plus pluck. The location card lands on F.
- **18 s outro:** the final Am chord and one bell ring out.

## Storyboard (every cut on a beat; times in seconds)

| # | Scene | Time | On screen |
|---|---|---|---|
| 1 | Hook | 0.0–4.0 | The composer at 2× scale, centred. **OFFER.** at 0.5 lights $; **NUMBER.** at 1.0 lights ☎; **MEETUP.** at 1.5 lights the pin. "Set up the whole deal in chat." lands at 2.0 and holds to 4.0 |
| 2 | Offer | 4.0–9.0 | The thread header: @mayapulls, Charizard Base Set Unlimited · Asking $320. 4.0 their bubble: "Still available — price is a bit negotiable for a quick pickup." 4.5 the offer bar opens and "290" types in on the eighths. 5.5 the OFFER · NON-BINDING **$290** card lands (mine), note "Cash, this weekend?". 7.0 it flips to OFFER ACCEPTED, and the system pill "Offer accepted · $290" appears. Caption on the right: **Make an offer.** (4.5), then "They accept with one tap." (7.0), held to 9.0 |
| 3 | Number | 9.0–13.0 | The phone bar: PHONE · [LB flag +961 ▾] · digits "70 000 000" typed on the eighths from 9.5 to 10.5 · SHARE NUMBER pressed at 11.0. 11.0 the card lands: "You shared your number" with the LB flag and +961 70 000 000. Caption: **Share your number.** (9.5), then "Only they see it. Never on your profile." (11.5), held to 13.0 |
| 4 | Meetup | 13.0–18.0 | The location bar with its two choices: "Use my current location" and "Choose on the map". 13.5 a tap on "Choose on the map". 14.0 the map picker rises and the map pans under the fixed pin until 15.0. 15.5 "Use this spot". 16.0 the location card lands: "Zaitunay Bay, Beirut", the mini-map with pin, the coordinates, GOOGLE MAPS and WAZE. Caption: **Pick a public spot.** (13.5), then "Opens in Google Maps or Waze." (16.5), held to 18.0 |
| 5 | Outro | 18.0–21.0 | 18.0 the recap row $ ☎ pin with OFFER · NUMBER · MEETUP. 18.5 the flag + LEBANONTCG. lockup. 19.0 "We connect collectors. You handle the deal." and www.lebanontcg.com, held to 21.0 |

Transitions: a lift and fade from the hook into the chat; vertical whips (up and out, up and in) between scenes 2, 3 and 4; a blur swap into the outro. Busy layouts never crossfade over each other: the old content leaves before the new arrives.

## Share caption
Find the card, then set up the whole deal in one chat on LebanonTCG: make an offer, share your number and pick a public spot on the map. No checkout, no fees. www.lebanontcg.com

## As built
- **Check:** HyperFrames check passed with zero errors. The remaining warnings were weighed and kept:
  - small UI chrome (button labels, timestamps) under the 28 px type floor, since the captions at 40–92 px carry the message;
  - the dimmed location bar under the map picker's overlay, which is meant to be unreadable there;
  - two duplicate-image notes, because the map and the flag appear twice on purpose.
- **Render:** 21.0 s, 1920×1080, 30 fps, −13.3 LUFS, −1.0 dBFS peak.
- **Soundtrack:** work/synth.py, 120 BPM. Every cut and effect is on the grid.
- **Poster and frame 0:** both come from 3.5 s, the three lit tools under "Set up the whole deal in chat."
- **Fixed after the first stills:**
  - The "Choose on the map" tap ring was moved onto the button.
  - A tap ring was faintly visible before its cue; it now only renders from its cue.
  - "✓ Offer accepted" was enlarged.
  - The location bar now dims under the map picker, as the app's overlay does.
