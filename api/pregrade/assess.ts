// Vercel serverless function: the ONLY place the Anthropic key lives.
// Receives the capture set (corner macros, edge strips, raking shots)
// as data URLs, runs the grading rubric through the vision model with
// strict JSON output, validates, retries once, then abstains.
//
// Env (Vercel project settings — never in the repo):
//   ANTHROPIC_API_KEY   required for live assessments
//   PREGRADE_DAILY_LIMIT  optional, default 10

import { abstention, parseAssessment } from '../../src/lib/pregrade/assessment';

// Public values (same ones baked into the client) — used to verify the
// caller's Supabase session token.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pisckiopuulgvtlukueo.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__aJyC2b3m0z2dpcuAVutJg_JvM9h-fh';

const MODEL = process.env.PREGRADE_MODEL || 'claude-sonnet-5';
const MAX_IMAGES = 12;
const MAX_BODY_IMAGE_CHARS = 700_000; // ~500KB decoded per image

const RUBRIC = `You are a trading-card condition assessor for a pre-grade ESTIMATE tool.
You score against the practical tolerances a high-volume PSA submitter uses, not the published ideal.
The core distinction, always: does a defect read as a FACTORY characteristic, or as HANDLING damage that breaks the card's surface?

You receive labelled photos: corner macros, edge strips cropped from flat-on shots, and (sometimes) raking-light surface shots.

CORNERS
- Four clean sharp corners -> 10.
- One or two corners with slight softness or a light ding, no whitening beyond a pinpoint -> 10, but set "borderline": true. Real submissions like this do come back 10.
- Visible whitening, fraying or fuzz at normal viewing distance -> 9.
- Any rounding, or whitening on three or more corners -> 8 or lower.

EDGES
- Clean cut, or slight fuzziness / rough factory cut with NO damage extending into the printed surface -> 10. Rough factory cuts routinely gem.
- Whitening along an edge visible without magnification -> 9.
- Chipping or any edge defect that bleeds into the surface leaving white inside the printed area -> type "bleed_into_surface", score 8 max. This is the failure that separates an acceptable edge from a disqualifying one.

SURFACE — only if raking-light shots are present. Otherwise set surface confidence "not_assessed" and score null. NEVER infer surface condition from flat-lit images.
- Clean -> 10.
- Print lines on the BACK, directional-light only -> 10. Negligible.
- Print lines on the FRONT, light-dependent only -> 10 with "borderline": true.
- A print defect visible in any lighting -> 9 max.
- One or two light shallow scratches, directional light only -> 10 with "borderline": true. MANY such scratches, even shallow -> 9. Quantity matters as much as depth.
- Deep scratch or mark visible in all lighting -> 8.
- DIMPLES (small circular indentations, common factory trait on ultra-modern stock): treat leniently, no cap, any count. Note them and move on. type "dimple".
- INDENTS (any depression with detectable TEXTURE, irregular outline — handling damage): type "indent", severity as seen. Distinguish carefully from dimples: dimple = circular, shallow, factory, tolerated; indent = irregular, textured, handling, fatal. Indents turn apparent 10s into 8s.

AUTHENTICITY: if stock, gloss, or cut looks unusual, add a string to "authenticity_flags" (e.g. "possible_trimming", "suspect_gloss", "off_stock"). Flags are soft notes, never verdicts.

HONESTY RULES
- When an attribute cannot be judged from the supplied images, set its "confidence": "not_assessed" and score null. Do NOT guess from other images. Guessing is a worse failure than admitting the photos aren't good enough.
- If the images are inadequate overall, set "abstain": true with a plain-language "abstain_reason".
- Note image problems in "image_quality_notes".

OUTPUT: ONLY a JSON object, no markdown fences, no commentary, exactly this shape:
{
  "corners": { "score": <1-10|null>, "confidence": "high|moderate|low|not_assessed", "borderline": <bool>,
    "findings": [ { "location": "top_left|top_right|bottom_right|bottom_left", "type": "soft|ding|whitening|fray|round", "severity": "trace|minor|moderate|severe", "note": "<collector language>" } ] },
  "edges": { "score": ..., "confidence": ..., "borderline": <bool>,
    "findings": [ { "location": "top|right|bottom|left", "type": "factory_cut|fuzz|whitening|chip|bleed_into_surface", "severity": ..., "note": ... } ] },
  "surface": { "score": ..., "confidence": ..., "borderline": <bool>,
    "findings": [ { "face": "front|back", "type": "print_line|scratch|dimple|indent|stain|gloss_break", "severity": ..., "note": ... } ] },
  "authenticity_flags": [],
  "image_quality_notes": [],
  "abstain": false,
  "abstain_reason": null
}`;

interface ImageIn {
  slot: string;
  dataUrl: string;
}

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

async function verifyUser(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, authorization: authHeader },
  });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string };
  return u.id ?? null;
}

async function todayCount(authHeader: string): Promise<number | null> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/pregrade_reports?select=id&created_at=gte.${today.toISOString()}`,
    {
      method: 'HEAD',
      headers: { apikey: SUPABASE_KEY, authorization: authHeader, prefer: 'count=exact' },
    },
  );
  if (!r.ok) return null; // table may not exist yet — don't block on it
  const range = r.headers.get('content-range');
  const total = range?.split('/')[1];
  return total ? Number(total) : null;
}

function parseDataUrl(dataUrl: string): { mediaType: string; b64: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { mediaType: m[1], b64: m[2] } : null;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
}

async function callModel(
  apiKey: string,
  images: ImageIn[],
  hasRake: boolean,
  feedback: string | null,
): Promise<string> {
  const content: unknown[] = [];
  for (const img of images) {
    const parsed = parseDataUrl(img.dataUrl);
    if (!parsed) continue;
    content.push({ type: 'text', text: `Image: ${img.slot}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: parsed.mediaType, data: parsed.b64 },
    });
  }
  content.push({
    type: 'text',
    text:
      `Raking-light shots provided: ${hasRake ? 'yes' : 'NO — surface must be not_assessed'}.` +
      (feedback ? `\nYour previous reply failed validation: ${feedback}\nReturn corrected JSON only.` : '') +
      '\nAssess now. JSON only.',
  });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: RUBRIC,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`model call failed (${r.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await r.json()) as { content: Array<{ type: string; text?: string }> };
  return data.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      error:
        'Assessment is not configured on this deployment — set ANTHROPIC_API_KEY in the Vercel project environment.',
    });
  }

  const userId = await verifyUser(req.headers.authorization);
  if (!userId) return json(res, 401, { error: 'Sign in to run an assessment.' });

  const limit = Number(process.env.PREGRADE_DAILY_LIMIT || 10);
  const count = await todayCount(req.headers.authorization);
  if (count !== null && count >= limit) {
    return json(res, 429, { error: `Daily pre-grade limit reached (${limit}). Try again tomorrow.` });
  }

  const body = req.body as { images?: ImageIn[]; hasRake?: boolean } | undefined;
  const images = (body?.images ?? []).slice(0, MAX_IMAGES);
  if (images.length < 4) return json(res, 400, { error: 'Not enough images to assess.' });
  for (const img of images) {
    if (typeof img.dataUrl !== 'string' || img.dataUrl.length > MAX_BODY_IMAGE_CHARS) {
      return json(res, 400, { error: 'Image too large or malformed.' });
    }
  }
  const hasRake = body?.hasRake === true;

  // One call; on contract failure, one retry with the reason; then abstain.
  let feedback: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callModel(apiKey, images, hasRake, feedback);
      const parsed = parseAssessment(extractJson(text));
      // Server-side honesty guard: no raking shots -> surface stays unassessed.
      if (!hasRake) {
        parsed.surface = { score: null, confidence: 'not_assessed', borderline: false, findings: [] };
      }
      return json(res, 200, { assessment: parsed });
    } catch (err) {
      feedback = err instanceof Error ? err.message : 'invalid output';
    }
  }
  return json(res, 200, {
    assessment: abstention(
      'The assessment did not produce a valid result from these photos. Nothing was guessed — try clearer shots.',
    ),
  });
}
