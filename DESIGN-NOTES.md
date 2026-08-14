# Cardpost — Design Notes

The visual language is extracted from the three uploaded design references
(described in `design-reference/README.md`; the source images arrived as
uploads attached to the build brief). All tokens live in
`src/styles/tokens.css`; this file records what was extracted and why, so
drift is detectable.

## References

- **R1 — "XNFT" marketplace hero (dark).** Near-black UI framed in a large
  rounded panel, vivid green CTA pills, uppercase letter-spaced nav with a
  green active state, stretched-caps display headline with a
  purple→pink→orange gradient on emphasis words, product cards with glassy
  blurred overlay chips (artist chip, price footer bar) and accent-colored
  price text.
- **R2 — "Cards for Marketplaces" sheet (light).** Product cards on a
  dotted-grid field. Chartreuse/lime as the signature highlight, vertical
  gradient card fills, tiny uppercase category labels with wide tracking,
  bold titles, one-line captions, squarish ~14px card radius.
- **R3 — Graded trading-card slab mockups (dark).** PSA-style grading
  labels: light label strip, red/black accent bars, huge heavy grade
  numeral, mono cert numbers, condensed uppercase type. Holo/foil card
  treatments on dark ground.

## Synthesis — what Cardpost looks like

**Dark app, one loud green.** The app ground is R1's near-black stack
(`--bg-0…4`, borders `#2a2c33`). Primary actions, active nav, and "live"
signals use R1's vivid green `#3edc5c` in pill shapes. R2's chartreuse
`#d8e627` is the second voice: prices, favorite marks, highlight fills.
The two greens are cousins, not competitors — green means *act*, lime
means *value*.

**Spectrum gradient is rare.** R1's purple→pink→orange gradient
(`--spectrum`) is reserved for the brand-level hero text and for
graded/holo card emphasis. It never appears on buttons or body UI.

**Typography: one family, two voices.** Archivo Variable (self-hosted).
Display voice = uppercase, expanded (125% stretch), weight 800, tight
leading — R1's hero and R2's sheet headline. Label voice = 11px uppercase,
+0.09em tracking — R2's "KEYBOARD" captions and R1's nav. Body stays
sentence-case at 14px/1.5. Cert numbers and message timestamps use mono.

**Cards.** Listing cards use R2's anatomy on R1's palette: image area on
top, then uppercase game micro-label, bold title, caption-sized set/detail
line, price in lime. 16px radius, subtle border, soft deep shadow, hover
lifts to `--bg-3` with a slightly stronger border.

**Slab labels for grades (R3).** Graded cards get a distinctive
slab-style badge: light `#f4f2ec` strip, red bar, heavy grade text, mono
cert-ish styling. This is the app's most literal quote of a reference and
is used anywhere a grade appears (cards, detail, chat pinned header).

**Glass chips (R1).** Overlays on top of imagery (gallery controls,
image-count chips, the chat's pinned listing header) use the glass recipe:
`rgba(23,24,28,.72)` + 1px `rgba(255,255,255,.08)` border + 14px blur,
pill or 12px radius.

**Field texture.** R2's dotted grid becomes a faint white dot grid
(4.5% alpha, 22px pitch) on the page ground only — panels sit on it clean.

**Shape language.** Pills for interactive chips/buttons (R1), 24px for
framed panels, 16px cards, 12px controls, 8px slab badges. Nothing square.

**Status colors.** Active = green, Reserved = amber, Sold = spectrum-free
neutral with lime price struck, Removed = muted. Condition scale runs
NM→DMG across green→lime→amber→red so condition reads at a glance.

**Game color coding.** Each game gets a hue (Pokémon gold, Magic orange,
Yu-Gi-Oh purple, One Piece red, Lorcana blue, Other gray) used for the
procedural mock card backs and the tiny dot next to game labels — never
for large fills.

## Anti-drift rules

1. No hex values in component CSS — tokens only.
2. Spectrum gradient only on hero text and grade/holo emphasis.
3. Uppercase = display or microlabel voice only, never body copy.
4. Any new component must quote at least one reference pattern (pill,
   glass chip, slab label, micro-label anatomy, dotted field).
