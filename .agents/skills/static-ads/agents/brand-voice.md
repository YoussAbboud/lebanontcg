# Brand Voice Agent (static-ads)

Map the shared brand kit into a static-ads-tailored brand voice — typography, palette, copy tone, do/don't rules. Lighter than full campaign DNA — only what affects copy-overlay static ads.

## Inputs (priority order)

1. **Primary**: `input/brands/{brand-slug}/brand.json` — the unified brand kit created by `tools/brand-intake-protocol.md`
2. **Visual augmentation**: `input/brands/{brand-slug}/logo/`, `ads-references/`, `voice-samples/` — read directly with vision/text reading if `brand.json` is sparse
3. **Fallback**: WebFetch the brand homepage if the kit is missing or `confidence: low`

## Process

1. Read `input/brands/{brand-slug}/brand.json` first.
2. If a static-ads-relevant field is missing (typography, color_palette, copy_tone), augment by reading reference images directly or by WebFetching.
3. Map fields into the static-ads schema below.
4. Save the resulting brand_voice.json.

## Output

Save to `input/static-ads/{brand}/{product}/_brand/brand_voice.json`:

```json
{
  "brand": "Nike",
  "url": "https://www.nike.com/kr",
  "typography": {
    "display_feel": "Bold sans-serif condensed, italic slash accents, heavy weight. Futura-adjacent. Feels athletic and commanding.",
    "body_feel": "Clean geometric sans-serif, regular weight. Reads fast.",
    "recommended_fonts_for_ads": ["Futura Bold Condensed", "Helvetica Neue Bold", "Suit"]
  },
  "color_palette": {
    "primary": "#111111",
    "secondary": "#FFFFFF",
    "accent": "#FF6B00",
    "neutral_bg": "#F5F5F5",
    "rules": "Deep black as dominant ink. White as canvas. Product color punches through as accent. Avoid pastel/muted tones."
  },
  "copy_tone": {
    "voice": "Direct · commanding · athletic. Short sentences. Action verbs. No filler.",
    "examples_from_brand": ["Just Do It", "Move with Freedom", "Unlimited You"],
    "signature_moves": "Imperative verbs at the start. 2-5 word headlines. Occasional all-caps for emphasis."
  },
  "dos": [
    "Use imperative verbs (GO, MOVE, RUN)",
    "Keep headlines under 5 words when possible",
    "High-contrast black-on-white or white-on-black"
  ],
  "donts": [
    "No soft/emotional adjectives (gentle, cozy, dreamy)",
    "No pastel color blocks",
    "No serif fonts",
    "No lowercase-only headlines"
  ],
  "visual_register": "Athletic-editorial. Energy and intent. Product always treated as hero."
}
```

## Quality check

Before saving, verify:
- **Typography** describes a recognizable style (not just "modern sans-serif")
- **Palette** has specific hex values (not "a warm palette")
- **Copy tone examples** are actual brand headlines you saw, not invented
- **Dos / Don'ts** are specific enough that a designer could follow them

If any field is generic, go back to the brand site and find something concrete.

## Rules

- WebFetch-only analysis is best-effort. If the site is JS-heavy and blank, note that in the output and rely more on references/ images.
- Do NOT invent brand headlines — if you can't find real ones, leave `examples_from_brand` empty.
- Save as valid JSON, UTF-8, no trailing commas.
