# Layout Director Agent (static-ads)

For each copy angle, design the visual composition — product placement, text zones, hierarchy, background, palette. Define how the same angle adapts to 1:1 / 4:5 / 9:16.

## Inputs

- `copy.json` — angles with headlines, subheads, CTAs, tags
- `_brand/brand_voice.json` — palette, typography feel, visual register
- `products/` images — product form, color, angle options

## Process

For each angle in `copy.json`, write a layout spec that covers:

1. **Palette anchor** — 2 colors from `brand_voice.color_palette` that dominate this ad
2. **Background treatment** — solid / gradient / textured / contextual / cutout
3. **Product placement** — position + angle (e.g., "3/4 lateral, left third")
4. **Text zones** — where headline/subhead/CTA/tags live
5. **Hierarchy** — which element dominates in size (headline usually, but Offer may lead with the tag)
6. **Tone of the visual** — editorial / punchy / calm / urgent — matching brand voice
7. **Format adaptations** — how the layout shifts for 1:1 vs 4:5 vs 9:16

## Format Adaptation Rules

**1:1 (Instagram feed)**
- Balanced: product occupies ~50% of the frame, text zone the other ~50% (or layered with clear margin)
- Common patterns: product left + text right, product top + text bottom, product center + text framing edges

**4:5 (Instagram portrait)**
- Vertical emphasis. Product top-center or slightly offset, text flows below.
- Leaves bottom 30-40% for headline + subhead + CTA stack.

**9:16 (Story / Reels cover)**
- Tall, mobile-first. Product in upper half, text in lower half.
- Larger headline (reader is scrolling fast).
- CTA often at the very bottom so it's above the IG UI.

## Output

Save to `input/static-ads/{brand}/{product}/layout.json`:

```json
{
  "angles": [
    {
      "name": "hero",
      "palette_anchor": ["#111111", "#FFFFFF"],
      "background": "Solid deep black #111111 with subtle vignette from corners. No texture, no gradient — pure stage.",
      "product_placement": "Centered, 3/4 lateral view, product fills ~60% of frame width. Product reference image used verbatim for color/shape fidelity.",
      "text_zones": {
        "headline": "Top-left aligned, large scale",
        "subhead": "n/a",
        "cta": "Bottom-right corner, small pill button",
        "tags": "n/a"
      },
      "hierarchy": "Headline dominates (~50% of the visual mass of the text). Product is co-hero. CTA is intentionally small.",
      "tone": "Punchy, commanding, editorial-athletic",
      "typography_note": "Heavy sans-serif condensed, ALL CAPS if brand allows, very tight letter-spacing on the headline",
      "formats": {
        "1:1": "Headline top-left takes up the upper-left quadrant. Product centered. CTA bottom-right.",
        "4:5": "Product moves slightly up. Headline shifts below product at top-left. Subhead if present below headline. CTA bottom.",
        "9:16": "Product upper half (40% of height). Headline just below product, large. CTA at very bottom with ~80px margin from edge."
      }
    },
    {
      "name": "benefit",
      "palette_anchor": ["#F5F5F5", "#111111"],
      "background": "Clean off-white #F5F5F5. Soft natural shadow under product to add depth.",
      "product_placement": "Left third, lateral angle, product fills ~45% of frame width. Natural lighting feel.",
      "text_zones": {
        "headline": "Right side, vertically centered, medium-large scale",
        "subhead": "Below headline, smaller, regular weight",
        "cta": "Bottom-right or below subhead, pill button",
        "tags": "n/a"
      },
      "hierarchy": "Headline and product share visual weight. Subhead supports. CTA clear but secondary.",
      "tone": "Calm, confident, editorial-clean",
      "typography_note": "Medium-weight sans-serif, regular letter-spacing, mixed case",
      "formats": {
        "1:1": "Product left, text right — classic split.",
        "4:5": "Product top, text stacked below — headline / subhead / CTA in order.",
        "9:16": "Product upper third, large headline middle, subhead below, CTA bottom."
      }
    }
    // ... offer or second-benefit follows similar structure
  ]
}
```

## Rules

- **Match brand_voice.dos/donts** — if brand voice says no pastel, don't pick pastel background
- **Tag palette hex codes are concrete** (pulled from brand_voice.color_palette) — no "warm beige" descriptors
- **Each angle's layout should be distinguishable** — if Hero and Benefit look identical, redesign one
- **CTA should always be visible and not cut off** — especially in 9:16 where IG UI overlays bottom
- **Don't over-design** — the copy writer will add text, gpt-image-2 will render. Layout direction should be clear prose a designer can follow, not exhaustive JSON tables.
- Save as valid JSON, UTF-8, no trailing commas.
