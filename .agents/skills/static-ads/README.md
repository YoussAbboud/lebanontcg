# Static Ads — Copy-Led Static Ad Creatives with Accurate Text Rendering

Generate static ad creatives (Instagram feed, portrait, story) with **headline, subhead, and CTA text rendered character-perfect inside the image** — not pasted on top. Takes a product image + brand URL and produces multiple copy angles across multiple formats and languages, with brand voice automatically pulled from the brand's site.

---

## What It Does

From one input (product + brand URL + CTA), you get:

- **Brand voice** mapped from the brand's website (palette, typography, copy tone)
- **N copy angles** — Hero / Benefit / Offer (default 3), or custom angles like Moment / Audience / Performance
- **3 formats per angle** — 1:1 (feed), 4:5 (portrait), 9:16 (story / reel)
- **Optional language variations** — Korean → English / Japanese / Chinese, same design with translated copy
- All text **rendered inside the image** with character-perfect accuracy (powered by `fal-ai/openai/gpt-image-2/edit`)

A standard run produces **9 ad creatives** (3 angles × 3 formats). Expanded to 4 angles × 3 formats × 3 languages = **36 ad creatives** in a single campaign.

---

## Pipeline Overview

```
Product image + Brand URL + CTA
          ↓
[1] Brand Intake               → input/brands/{brand}/brand.json
[2] Brand Voice (lightweight)  → _brand/brand_voice.json
[3] Copy Writing               → copy.json (N angles)
[4] Art Direction              → art_direction.json
[5] Layout                     → layout.json
[6] COPY REVIEW (gate)         ← user approves text
[7] 1:1 Prompt Composition     → prompts.json (1:1 only)
[8] Generate 1:1 시안          → final/{name}-1x1.png
[9] 시안 REVIEW (gate)         ← user approves visual direction
[10] Format Expansion (4:5+9:16) → 추가 ads
[11] Language Variations       → final/{lang}/{name}.png
```

Two **review gates** prevent wasted renders: copy is approved before any image is generated, and the 1:1 visual direction is approved before format/language expansion.

---

## Why Text Rendering Matters

Most static-ad generators slap text overlays on top of the image at the end. That's brittle — fonts drift, kerning breaks, layouts collapse on resize.

This skill uses `fal-ai/openai/gpt-image-2/edit`, which renders text **as part of the image** during generation. That means:
- Korean / English / Japanese / Chinese characters render character-perfect
- Text composes naturally with the visual elements (light, shadow, depth)
- Each format gets a layout designed for that aspect ratio, not a forced crop

---

## Getting Started

### 1. Download from GitHub

```
https://github.com/byextremeai/static-ads
```

Click **Code → Download ZIP** and extract, or clone:

```bash
git clone https://github.com/byextremeai/static-ads.git
```

---

### 2. Place the Files

Open your project in Claude Code and say:

> "Create a .claude/skills folder"

Then move the extracted `static-ads` folder into `.claude/skills/`:

```
your-project/
└── .claude/
    └── skills/
        └── static-ads/         ← place it here
            ├── SKILL.md
            ├── agents/
            └── scripts/
                └── generate.py
```

---

### 3. Install Python

If Python is not installed:

1. Go to [python.org](https://python.org) → click **Download Python**
2. During installation, check **"Add Python to PATH"**
3. Restart your terminal after installation

Verify:

```bash
python --version
```

---

### 4. Install Dependencies

Run this in your terminal (any directory):

```bash
pip install fal-client python-dotenv
```

---

### 5. Get a FAL API Key

1. Go to [fal.ai](https://fal.ai) → Sign up
2. Dashboard → **API Keys** → **Create new key**
3. Copy the key
4. Dashboard → **Billing** → Add a card and top up credits

---

### 6. Set Up .env

Create a `.env` file in your project root (same level as the `.claude` folder):

```
FAL_KEY=your-api-key-here
```

> Never commit `.env` to git.

---

## Usage

### 1. Open your project in Claude Code

### 2. Start the skill

Talk to Claude:

> "스태틱 광고 만들어줘"
> "Create static ads"

Claude will ask for:

- **Brand URL** (e.g., `https://www.redbull.com/kr-ko`)
- **Product name** (e.g., `Sugar Free`)
- **CTA** — picks one or you specify (`지금 구매`, `Shop Now`, custom)
- **Optional brief** — offer, primary benefit, target audience, language, must-include / must-avoid phrases

---

### 3. Add your product images

Claude will create the input folder. Drop 1–8 product images (different angles work best) into:

```
input/static-ads/{brand}/{product}/products/
```

---

### 4. Approve copy

Claude generates N copy angles (Hero / Benefit / Offer by default) and presents them as plain text:

```
[1] Hero — KICKER / "{headline}" / "{subhead}" / {proof_point} / {CTA}
[2] Benefit — ...
[3] Offer — ...
```

You approve, edit, or ask for new angles before any image is generated.

---

### 5. Approve 1:1 시안

Claude generates **1:1 시안 (square draft) only** for each approved angle. You review the visual direction. If a 시안 needs a tweak, regenerate it (versioned `_v2`, `_v3` so you never lose a good take).

---

### 6. Expand formats

Once 1:1 시안 is approved, Claude expands each angle to **4:5 (portrait)** and **9:16 (story)** in the same visual direction.

---

### 7. Language variations (optional)

Claude asks if you want translated versions:

> "언어 베리에이션도 만드시겠어요? (영어 / 일본어 / 중국어)"

If yes, the copy is translated and re-rendered with the same design — only the text changes. Output saved with `-{lang}` suffix.

---

### 8. View results

```
output/static-ads/{brand}/{product}/final/
├── 01-hero-1x1.png
├── 01-hero-4x5.png
├── 01-hero-9x16.png
├── 01-hero-4x5-en.png         ← language variation
├── 01-hero-4x5-ja.png
├── 02-benefit-1x1.png
├── ...
```

---

## Copy Structure

Every angle uses the same five-element structure:

| Field | Example | Length |
|-------|---------|--------|
| **kicker** | `WINGS` / `3 PM` / `MIDNIGHT` | 2–6 chars |
| **headline** | `날개는 그대로, 설탕은 0` | 5–14 chars (KR) / 3–8 words (EN) |
| **subhead** | `Red Bull Sugar Free` | 14–30 chars |
| **proof_point** | `0 SUGAR` / `5 KCAL` | 2–8 chars |
| **cta** | `지금 구매` / `Shop Now` | 2–10 chars |

Headlines follow specific formulas (parallel structure, time-of-day frame, problem flip + duration, etc.) to avoid generic AI-copywriter feel.

---

## Models Used

- Brand voice: web analysis via Claude
- Ad image generation: `fal-ai/openai/gpt-image-2/edit` — chosen specifically for accurate multilingual text rendering
- Reference images: product photo passed every time to keep product color, label, and silhouette faithful

---

## Customization

If your brand needs different angles than Hero / Benefit / Offer:

- **Real brand with a known offer**: Hero · Benefit · Offer (default)
- **No offer** (no promo to advertise): Hero · Benefit 1 · Benefit 2
- **Lifestyle brand**: Moment · Audience · Performance (contextual angles for time, user, use-case)

You can also specify number of formats (e.g., 1:1 only) or language only (e.g., English from the start).

---

## Troubleshooting

- **No FAL_KEY**: Make sure `.env` exists in the project root with `FAL_KEY=...`
- **Text rendered with wrong characters**: gpt-image-2 occasionally fails on small/dense text. Regenerate the affected ad with `--ads {name}` — the script versions outputs as `_v2` so you never lose a good take.
- **Wrong language characters mixed in**: Make sure the prompt explicitly says "ALL TEXT IN [LANG] ONLY — NO [other lang] characters" for language variations.
- **Generation failed (downstream service unavailable)**: Transient fal.ai backend issue. Retry the same command — it usually works on the second try.
- **Headline too long for the format**: Korean headlines should be 5–14 chars, English 3–8 words. Longer text breaks layout on smaller formats (9:16 especially). Shorten and regenerate.
