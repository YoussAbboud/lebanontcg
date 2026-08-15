# LebanonTCG — Design Notes

The visual language is the **Sleeved** system — the owner-authored Claude
design component checked into `design-reference/sleeved/Sleeved.dc.html`
(with its assets, including the animated flag-gif logo). That file is the
pixel source of truth; `src/styles/tokens.css` transcribes it and this
file records the mapping so drift is detectable.

## Reference

- **R6 — "Sleeved" design component (GOVERNING).** A complete seven-screen
  dark marketplace: framed 1400px shell on near-black, acid-lime accent,
  Chakra Petch display caps, JetBrains Mono micro-labels, 3D fan hero,
  gradient listing cards with hash-picked acid variants, sidebar browse,
  ranked sellers, offer-driven chat, 4-step sell wizard, acid toast.
  Earlier references (R1-R5) are retired; the flag gif from R5 survives as
  the header logo, straight from the component's own assets.

## Transcription — how the component maps to the app

**Shell.** body #08090B padded 14px; the app lives in a #0E1013 frame,
radius 28, hairline #16191E border, violet/acid radial glow overlay
(--frame-glow). Header: gif logo 38px + "LEBANONTCG." wordmark (Chakra
700, .06em tracking, acid dot), centre mono nav with a 22x2px acid tab
above the active item, search circle + acid "List a card" pill right.
Footer: mono tagline + Trading safely / Watchlist / Settings.

**Type.** Chakra Petch 600/700 uppercase -0.02em for display; Inter for
body; JetBrains Mono 500 11px/.12em uppercase for labels, buttons, stats,
prices (13px/.04em for values). All three self-hosted via @fontsource.

**Color.** Ground #08090B/#0E1013; surfaces #16191E; card gradient
#1F242B to #2A3038; borders #2A3038; ink #F2F5F7/#B9C2CC/#7B8590. One
accent: acid #D6FF3F (hover #9BC400) with dark #08090B text. Brand
gradient violet-cyan-pink only on rank chips; hero gradient
violet-cyan-acid only on the headline word. Pink #FF5C8A doubles as
danger.

**Cards.** r20, deep soft shadow, hover translateY(-4px). Anatomy: seller
dot (per-handle hue gradient) + handle + like-count pill; face (photo, or
per-id hue nebula + giant Chakra glyph) with watch chip; mono eyebrow
GAME · SET · GRADE; Chakra title (2-line clamp); one-liner; ASKING /
LISTED mono columns over a rule; full-width "Message seller" outline CTA.
Every hash(id)%4==0 card flips to the acid gradient with ink text and an
ink CTA.

**Fan hero.** Up to 7 cards in 1600px perspective; per-slot transforms
x ±[0,60,106,142]%, rotateY ±[0,18,27,33]deg, z -[0,60,110,160]px, scale
1-0.1·|off| (hover x1.09 +90px z), brightness 1-0.22·|off|, 950ms
cubic-bezier(.2,.8,.2,1); centre card gets the acid glow shadow and its
info panel (seller, listed, asking, MORE →) revealed via max-height.
Auto-advance 5s, paused on hover/focus, dots grow 8 to 26px in acid.

**Chat.** Inbox rows with card-face thumbs and acid unread dots; thread
header carries the listing thumb, asking, live status, seller actions
("We completed this deal" = mark sold) and View listing. Own bubbles are
acid with ink text; offers are surface bubbles with an acid border,
"OFFER · NON-BINDING" label, Chakra amount, Accept (acid) / Decline
(pink outline) for the recipient, and a settled state line. Composer:
$ offer toggle circle, rounded input, acid Send, safety line below.

**Sell wizard.** 4 steps (Photos / The card / The deal / Review), acid
progress bars + mono step labels, dashed-acid cover slot on a striped
ground, condition tiles with plain-language descriptions, live real
grid-card preview on Review.

## Anti-drift rules

1. No raw colors in component CSS — tokens only
   (grep -rn "#|rgba(" src --include="*.css" | grep -v tokens.css |
   grep -v mask-image must stay empty; hue-derived faces come from
   src/lib/face.ts).
2. Acid means *act*: buttons, active pills, watch-on, unread, live
   status. Never body text.
3. The brand gradient appears only on rank chips; the hero gradient only
   on the headline word.
4. Mono voice for every label/stat/button; Chakra only for display;
   Inter for everything else.
5. Any new surface must quote the component: framed panel, gradient
   card, mono label pair, pill, or nebula face.
