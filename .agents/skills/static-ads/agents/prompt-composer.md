# Prompt Composer Agent (static-ads)

Assemble final gpt-image-2/edit prompts for every (angle × format) pair. Copy text must appear in prompts literally within double quotes so gpt-image-2 renders it character-for-character.

## Inputs

- `copy.json` — headlines, subheads, CTAs, tags per angle
- `layout.json` — composition, background, placement, format adaptations
- `_brand/brand_voice.json` — palette, typography feel
- `products/` — for product description context

## Process

For each angle × format pair, assemble a single-string prompt covering:

1. **Ad type declaration** — "Static ad creative, {aspect_ratio} aspect ratio"
2. **Product description** — short factual description of the product (color, silhouette, material). Use product image(s) as reference — gpt-image-2/edit will honor them.
3. **Background + palette** — from layout.json
4. **Composition** — product placement + text zones from layout.json formats
5. **Text rendering — CRITICAL** — every copy string quoted literally in the prompt:
   - `Large bold headline reads exactly: "하루 종일 편한 쿠셔닝"`
   - `Below headline in smaller weight: "지친 발이 다시 가벼워지는 순간"`
   - `Small pill button at bottom-right with text: "지금 구매"`
   - Tags (if any): `Small badge in top-right corner with text: "SALE"`
6. **Typography style** — match brand_voice.typography.display_feel
7. **Text quality clause** — "Text must be precisely rendered, spelling perfect, clean kerning, professional ad legibility."
8. **Aesthetic clause** — "Professional ecommerce ad. High-fidelity. Clean production value."

Keep the prompt 1 paragraph. Dense but readable. Every design decision should be explicit.

## Output

Save to `input/static-ads/{brand}/{product}/prompts.json`:

```json
{
  "ads": [
    {
      "name": "01-hero-1x1",
      "angle": "hero",
      "aspect_ratio": "1:1",
      "reference_images": ["product", "brand_references"],
      "prompt": "Static ad creative, 1:1 square aspect ratio. Subject: Nike Air Force 1 '07 sneaker in crisp white leather with white midsole and gum outsole, exact same product as the reference image — keep color, silhouette, stitching, and logo faithful. Background: solid deep black #111111 with subtle corner vignette, no texture. Composition: product centered three-quarter lateral view filling roughly 60% of the frame. Typography: heavy condensed sans-serif, Futura-adjacent, tight letter-spacing. Top-left corner of the frame has a large bold headline reading exactly: \"움직여, 더 멀리\" — ALL CAPS if the language renders cleanly, otherwise keep normal case. Bottom-right corner has a small white pill button with black text reading exactly: \"지금 구매\". No subhead, no tags. Text must be precisely rendered — spelling perfect, clean kerning, professional ad legibility. Professional ecommerce ad, high-fidelity, clean production value, athletic-editorial energy."
    },
    {
      "name": "01-hero-4x5",
      "angle": "hero",
      "aspect_ratio": "4:5",
      "reference_images": ["product", "brand_references"],
      "prompt": "Static ad creative, 4:5 portrait aspect ratio. Subject: Nike Air Force 1 '07 sneaker in crisp white leather, keep exact color and silhouette from the reference image. Background: solid deep black #111111 with subtle corner vignette. Composition: product in the upper portion of the frame at three-quarter lateral view, filling ~50% of width. Below the product, large bold condensed sans-serif headline reading exactly: \"움직여, 더 멀리\". Far bottom: small white pill button with black text reading exactly: \"지금 구매\". Generous black negative space between elements. Text must be precisely rendered, spelling perfect, clean kerning. Professional ecommerce ad, athletic-editorial energy."
    },
    {
      "name": "01-hero-9x16",
      "angle": "hero",
      "aspect_ratio": "9:16",
      "reference_images": ["product", "brand_references"],
      "prompt": "Static ad creative, 9:16 vertical aspect ratio (Story/Reel). Subject: Nike Air Force 1 '07 white sneaker, exact color and silhouette from the reference image. Background: solid deep black #111111. Composition: product in the upper third of the frame, three-quarter lateral view. Middle third: very large bold condensed sans-serif headline reading exactly: \"움직여, 더 멀리\" — letter-spacing tight, weight heavy. Lower third: ample negative space. Bottom 10% of frame: small white pill button with black text reading exactly: \"지금 구매\", positioned with 80px margin from the bottom edge so it stays above IG UI overlays. Text must be precisely rendered, spelling perfect. Professional ecommerce ad, athletic-editorial energy."
    }
    // ... repeat the same structure for benefit × 3 formats and offer × 3 formats = 9 total entries
  ]
}
```

## Rules

- **Always quote copy strings literally** using `exactly: "…"` phrasing so gpt-image-2 knows the text must be rendered character-for-character. Never paraphrase headline/subhead/CTA inside the prompt.
- **Spell out punctuation and special characters**. If the headline has `·` or `—`, write it exactly.
- **Include the text quality clause** in every prompt: "Text must be precisely rendered, spelling perfect, clean kerning".
- **Reference the product image explicitly** — say "keep exact color, silhouette, logo from the reference image" so gpt-image-2 honors it.
- **Every prompt is self-contained** — don't rely on prior prompts. Each must stand alone.
- **`reference_images`** should list which reference types to pass — typically `["product", "brand_references"]`. The generate script routes these from input folders.
- **Total entries** = angles × formats. Default 3 × 3 = 9. If user asked for fewer formats or angles, adjust.
- Save as valid JSON, UTF-8, no trailing commas.

## Quality Check

Before saving:
- [ ] Every copy string from copy.json appears literally in at least one prompt
- [ ] Every prompt specifies aspect_ratio, background, product placement, text placement, typography
- [ ] Text quality clause present in every prompt
- [ ] No invented copy that isn't in copy.json
- [ ] No paraphrasing of copy inside prompts
