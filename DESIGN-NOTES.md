# LebanonTCG — Design Notes

The visual language is extracted from the uploaded design references
(described in `design-reference/README.md`; the source images arrived as
uploads attached to the build brief and the follow-up review). All tokens
live in `src/styles/tokens.css`; this file records what was extracted and
why, so drift is detectable.

## References

- **R4 — "NVC" purple marketplace hero (GOVERNING).** Violet gradient
  field (lilac → violet → near-black toward the lower right) with soft
  vertical light rays under the header. Floating segmented pill nav in the
  top center (white active segment, dark translucent container), small
  logo top-left, avatar top-right. Huge sentence-case hero headline in a
  medium-weight grotesque with a white→translucent gradient fade, small
  glass "Discover" chip above, quiet sub line below. An auto-scrolling
  rail of glassy cards: avatar + name + @handle header, rounded media,
  price row with a coin mark and a tiny dark stat pill. White pill CTA
  ("Explore") beneath.
- **R5 — Lebanese flag trading card (brand mark).** The animated logo: a
  gold-bordered slab-style card with the red/white/red bands and green
  cedar. Recreated as inline SVG (`FlagLogo`) with a recurring holo-shine
  sweep standing in for the gif's animation. Its red/green/gold appear
  only in the brand mark and tiny national accents (unread badge,
  favorite heart) — never as large UI chrome.
- **R1 — "XNFT" dark marketplace hero.** Survives as the glass-chip
  recipe (blurred translucent overlays on imagery) and the framed
  large-radius panel shape.
- **R3 — Graded slab mockups.** Slab-label grade badge (light strip, red
  bar, heavy grade text) — unchanged, used anywhere a grade appears.
- *(R2 — lime marketplace cards, first round.)* Retired as a color
  direction; its condition-scale greens/limes remain only inside the
  NM→DMG condition ramp.

## Synthesis — what LebanonTCG looks like

**One violet field, glass everything.** The page ground is a single fixed
gradient (`--page-gradient`) with light rays fading in from the top
(`body::before`). Content sits on two glass levels: dark glass panels
(`--bg-1`, framed sections like chat and forms) and light glass cards
(`--bg-2`) — both blurred, both 1px white-alpha bordered. Nothing is
opaque except imagery and slab labels.

**White is the action color.** R4's CTAs, active nav segment, selected
chips, and focus rings are all white pills with deep-violet text
(`--accent` / `--text-inverse`). Green now means only "success/active
status"; the Lebanese flag red is reserved for brand, unread counts,
favorites, and destructive accents.

**Type: one family, sentence case.** Archivo Variable. Display voice =
sentence case, weight ~560, −0.02em tracking, tight leading (R4's
headline); the hero adds the white→translucent gradient via `.hero-text`.
Micro-labels stay small uppercase with wide tracking for metadata
captions. Mono for timestamps/cert numbers.

**Cards quote R4's anatomy** top to bottom: seller avatar + display name
+ @handle, rounded media (`--r-media` inside `--r-card`), title +
game line, then the price row — white coin mark, bold white price, tiny
dark condition pill. Slab badges and status badges overlay the media.

**The rail.** The home page's featured carousel auto-scrolls continuously
(duplicated track, −50% translate loop, ~42s), pauses on hover/focus,
fades at the viewport edges, and degrades to a manually scrollable row
under `prefers-reduced-motion`.

**Shape language.** Pills for anything interactive, 28px framed panels,
22px cards, 14px media/controls, 9px slab badges. Soft, deep shadows.

**Status + condition colors** are unchanged semantically: Active green,
Reserved amber, Sold neutral, Removed muted; conditions ramp
green→lime→amber→red. Game hues color the procedural card backs and tiny
game dots only.

## Anti-drift rules

1. No raw color values in component CSS — tokens only
   (`grep -rn "#\|rgba(" src --include="*.css" | grep -v tokens.css |
   grep -v mask-image` — mask alpha ramps are structural, not palette).
2. Flag red/green/gold appear only in the brand mark and micro-accents.
3. White pill = interactive/selected; glass = surface; never a solid
   colored button besides danger.
4. Sentence case for headings; uppercase only in micro-labels.
5. Any new component must quote a reference pattern (pill, glass chip,
   R4 card anatomy, slab label, coin+stat-pill price row).
