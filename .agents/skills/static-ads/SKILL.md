---
name: static-ads
description: >
  Generates static ad creatives with precisely rendered text overlay (headline,
  subhead, CTA) from a product image + brand URL. Uses fal-ai/openai/gpt-image-2/edit
  for its strong text rendering. Produces 3 copy angles (Hero · Benefit · Offer) ×
  3 formats (1:1 · 4:5 · 9:16) by default = 9 ad creatives per run, with consistent
  brand voice pulled from the brand's website. Use this skill whenever the user
  wants to: create static ads with readable copy baked into the image, produce IG
  feed / story / portrait ads with text, generate ad variants with different
  headlines, or build copy-led ad creatives.
  Trigger on phrases like: "정적 광고", "스태틱 광고", "static ads", "텍스트 광고",
  "광고 카피", "헤드라인 광고", "피드 광고 카피", "story 광고", "IG 광고 이미지",
  "광고 카피 넣어줘", "카피 라이팅 광고", "ad creative with text".
---

# Static Ads Pipeline

End-to-end pipeline that turns a product image + brand URL into 9 static ad creatives (3 copy angles × 3 formats) with accurately rendered text overlay, all in one run. Uses gpt-image-2/edit for text fidelity.

## Intake

### 1. Ask the user for:

**Required:**
- **Brand URL** (e.g., `https://www.nike.com/kr`)
- **Product name** (e.g., `에어 포스 1 '07`)
- **CTA** — ALWAYS ask, never default silently. Pick one or write custom:
  - 구매 유도: `지금 구매` / `구매하기` / `주문하기`
  - 인지/탐색: `더 알아보기` / `자세히 보기`
  - DM/팔로우: `링크 인 바이오` / `프로필 클릭`
  - 행동 유도: `지금 시작` / `도전해보기`
  - 또는 사용자 지정 문구

**Optional brief** (skip questions the user doesn't have an answer for):
- Offer/promo: "30% 할인", "신상 출시" or none
- Primary benefit: "하루 종일 편한 쿠셔닝"
- Target audience: "20대 도시 남성"
- Language: `ko` (default) / `en` / `mixed`
- Must-include phrases: e.g. "Free shipping"
- Must-avoid phrases: e.g. "최저가", "무조건"

If the user doesn't have a brief, proceed with brand-voice-driven defaults. **But always confirm CTA before generating — don't silently default to "지금 구매".**

### 2. Derive slugs and create folders:
```bash
py -3 .claude/skills/static-ads/scripts/generate.py --campaign {brand}/{product} --setup
```

### 3. Drop product images:
```
input/static-ads/{brand}/{product}/products/
```

Recommend 3-5 angles (front, side, detail, context). Max 8.

### Directory Structure

```
input/static-ads/{brand}/{product}/
├── products/          ← Product images (required)
├── _brand/            ← Optional brand-level assets
│   ├── brand_voice.json
│   └── references/    ← Logo / design samples / textures
├── brief.json         ← User brief (optional)
├── copy.json          ← Step 2 output
├── layout.json        ← Step 3 output
└── prompts.json       ← Step 4 output

output/static-ads/{brand}/{product}/
└── final/             ← Step 5 output
    ├── 01-hero-1x1.png
    ├── 01-hero-4x5.png
    ├── 01-hero-9x16.png
    ├── 02-benefit-1x1.png
    ├── 02-benefit-4x5.png
    ├── 02-benefit-9x16.png
    ├── 03-offer-1x1.png
    ├── 03-offer-4x5.png
    └── 03-offer-9x16.png
```

---

## Pipeline

### Step 0: Brand Intake (shared protocol)

**Before anything else, follow `tools/brand-intake-protocol.md`** — the standardized brand intake flow shared across all brand-related skills.

In short:
1. Check if `input/brands/{brand-slug}/brand.json` already exists. If yes, reuse it and skip to Step 2.
2. If not, run `py -3 tools/brand-setup.py {brand-slug}` to create the folder skeleton.
3. Tell the user to drop logo / ads-references / photography files into the brand folder.
4. Ask 2-3 chat questions for non-visual info (must-avoid phrases, ad goal, etc.).
5. Read all dropped assets (vision) + chat answers + URL fallback if needed.
6. Generate `input/brands/{brand-slug}/brand.json` per the schema in the protocol.

The user never edits JSON. Files-only intake.

### Step 1: Brand Voice (lightweight pass-through)

Read `agents/brand-voice.md` and follow it.

- **Input**: `input/brands/{brand-slug}/brand.json` (created by Step 0)
- **Action**: Map the unified brand kit's typography / color_palette / copy_tone / constraints into a static-ads-shaped `brand_voice.json`. Most fields are passthrough; supplement only what's missing.
- **Note**: This step is now lightweight — `brand.json` already has most of what's needed. If a field is missing or `confidence: low`, augment via WebFetch fallback.
- **Output**: `input/static-ads/{brand}/{product}/_brand/brand_voice.json`
- **Cache**: If `_brand/brand_voice.json` already exists, offer to reuse. Re-run only if user asks.

### Step 2: Copy Writing

Read `agents/copy-writer.md` and follow it.

- **Input**: `brand_voice.json` + product images (look at them) + `brief.json` (if provided)
- **Action**: Generate 3 distinct copy angles:
  1. **Hero** — brand-led identity headline ("Just Do It" style)
  2. **Benefit** — specific outcome headline ("하루 종일 편한 쿠셔닝")
  3. **Offer** — promo-led headline ("30% OFF · 오늘까지")
  Each angle has: `headline`, `subhead` (optional), `cta`, `tags` (optional badges/price).
- **Output**: `input/static-ads/{brand}/{product}/copy.json`

### Step 3a: Art Direction (senior-level creative direction)

Read `agents/art-director.md` and follow it.

- **Input**: `copy.json` + `brand_voice.json` + brand kit + product images + `input/brands/{brand}/ads-references/`
- **Action**: Senior art director output — define big idea, composition rule, typographic system, color discipline, product treatment (lighting/shadow/surface), brand-specific motif, format adaptations. Reject cliches. Each angle must be distinct.
- **Output**: `input/static-ads/{brand}/{product}/art_direction.json`
- **Why**: Without this step, ads default to "centered product + headline + CTA" and look amateur. This agent forces sophisticated design choices.

### Step 3b: Layout (concrete spatial layout)

Read `agents/layout-director.md` and follow it.

- **Input**: `art_direction.json` + `copy.json` + product images
- **Action**: Take the art direction and produce concrete spatial coordinates — exact text positions, sizes, alignments per format. This is the "translation" layer between high-level direction and the rendering prompt.
- **Output**: `input/static-ads/{brand}/{product}/layout.json`

### Step 4: Copy Review (gate)

**Before any image generation, present `copy.json` to the user as plain text and ask for approval.**

Format:
```
[1] Hero — KICKER / "{headline}" / "{subhead}" / {proof_point} / {CTA}
[2] {angle 2} — ...
```

Ask: "이 카피로 시안 진행할까요? 수정 필요한 헤드라인 있으면 알려주세요."

**Do NOT proceed to prompt composition or generation until the user approves the copy.** This avoids wasting renders on copy the user will reject.

### Step 5: Prompt Composition (1:1 시안 only)

Read `agents/prompt-composer.md` and follow it.

- **Input**: `copy.json` + `layout.json` + `brand_voice.json`
- **Action**: Build concrete gpt-image-2/edit prompts for each angle in **1:1 format only** (one ad per angle). This is the 시안 stage — show the user the visual direction in square format BEFORE committing time/cost to format expansion. Copy text must appear in the prompt literally within quotes so gpt-image-2 renders it exactly.
- **Output**: `input/static-ads/{brand}/{product}/prompts.json`

Expected structure:
```json
{
  "ads": [
    {
      "name": "01-hero-1x1",
      "angle": "hero",
      "aspect_ratio": "1:1",
      "prompt": "…",
      "reference_images": ["product", "brand_references"]
    },
    // … one entry per angle, 1:1 only at this stage
  ]
}
```

### Step 6: Generate 시안 (1:1 only)

```bash
py -3 .claude/skills/static-ads/scripts/generate.py --campaign {brand}/{product} --mode generate
```

For each prompt:
- Uploads product + brand reference images
- Calls `fal-ai/openai/gpt-image-2/edit` with the prompt + references + aspect_ratio
- Saves to `output/static-ads/{brand}/{product}/final/{name}.png`

### Step 7: 시안 Review (gate)

Show the user the generated 1:1 시안 with file links. Ask:
> "시안 보시고 수정/추가/교체 필요한 부분 있으세요? OK 하시면 4:5 / 9:16 비율로 확장하고 언어 베리에이션도 진행합니다."

Iterate on individual 시안 if needed (preserves prior takes as `_v2`):
```bash
py -3 .claude/skills/static-ads/scripts/generate.py --campaign {brand}/{product} --mode generate --ads 01-hero-1x1
```

**Do NOT expand to 4:5 / 9:16 until the user approves the 1:1 시안.**

### Step 8: Format Expansion (4:5 + 9:16)

After 시안 approval:
1. Update `prompts.json`: add 4:5 and 9:16 entries for each approved angle (each angle gets 2 new entries → total: N×3 ads)
2. Generate the new entries:
```bash
py -3 .claude/skills/static-ads/scripts/generate.py --campaign {brand}/{product} --mode generate --ads {comma-separated new names}
```

### Step 9: Language Variations (final step — always ask)

After all formats are generated, **always ask the user**:
> "언어 베리에이션도 만드시겠어요? (영어 / 일본어 / 중국어 / 다른 언어 — 카피만 번역해서 같은 디자인으로 재렌더)"

If yes:
1. Translate the relevant copy fields (kicker / headline / subhead / proof_point / CTA) into the requested language(s). CTA also localized appropriately (e.g., "지금 구매" → "Shop Now" / "今すぐ購入").
2. Save translated copy as `copy.{lang}.json` (e.g., `copy.en.json`, `copy.ja.json`).
3. Build new prompts.json entries with translated copy and new naming convention `{NN}-{angle}-{format}-{lang}.png`.
4. Run generation for the new variations.
5. Save outputs to `output/static-ads/{brand}/{product}/final/{lang}/...` to keep languages organized.

If no, the campaign is complete.

---

## Iteration mid-flow

- To adjust copy: edit `copy.json` → re-run Step 5 (prompt composition) → Step 6 (generate).
- To adjust layout: edit `art_direction.json` / `layout.json` → re-run Step 5 → Step 6.
- All regenerations of an existing filename create `_v2`, `_v3`… (never overwrite).

---

## Defaults

- **Angles**: Hero / Benefit / Offer (3)
- **Formats**: 1:1 / 4:5 / 9:16 (3)
- **Total per run**: 9 ad creatives
- **Language**: Korean (headline + CTA in Korean; brand name can stay English)
- **CTA options**: "지금 구매" (default), "지금 시작", "링크 인 바이오", user-specified
- **Model**: `fal-ai/openai/gpt-image-2/edit` — chosen specifically for accurate text rendering

If the user requests fewer angles or formats (e.g. "Offer 빼고 2개 앵글만, 1:1만"), honor it — adjust `copy.json` and `prompts.json` accordingly before generation.

---

## Rules

- **Text accuracy is the whole point** — every copy string in the prompt must be quoted literally (`headline: "..."`), so gpt-image-2 renders it character-for-character. Do not paraphrase copy inside the prompt.
- **Product must stay visually accurate** — product reference images are always passed; prompt tells the model to keep product color/silhouette/logo faithful.
- **No fabricated offers** — don't invent "30% OFF" if the user didn't provide an offer. If no offer, replace the Offer angle with a 2nd Benefit angle.
- **No misleading claims** — no "최저가", "검증된", "임상 결과" unless the user gave a real stat.
- **Headline length**: Korean 5-14 chars, English 3-8 words. One line preferred.
- **Subhead (optional)**: Korean 10-25 chars, English 5-12 words. One line.
- **CTA**: Always one of the approved defaults or user-specified.
- **All agent files and prompts in English**. Ad copy values in Korean (or user-specified language).
- **Output folder**: `output/static-ads/{brand}/{product}/final/`
- **Run scripts with `py -3`** on Windows.
