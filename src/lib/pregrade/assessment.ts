// Defect-assessment contract validation. The model (or the mock)
// produces snake_case JSON per the rubric; this parses and validates it
// strictly — on failure the caller retries once, then abstains. A
// confident wrong number is the worst outcome; a rejected parse never
// becomes a report.

import type {
  AttributeAssessment,
  CornerFinding,
  DefectAssessment,
  EdgeFinding,
  FindingSeverity,
  PregradeConfidence,
  SurfaceFinding,
} from './types';

const CONFIDENCES: PregradeConfidence[] = ['high', 'moderate', 'low', 'not_assessed'];
const SEVERITIES: FindingSeverity[] = ['trace', 'minor', 'moderate', 'severe'];
const CORNER_LOCS = ['top_left', 'top_right', 'bottom_right', 'bottom_left'];
const CORNER_TYPES = ['soft', 'ding', 'whitening', 'fray', 'round'];
const EDGE_LOCS = ['top', 'right', 'bottom', 'left'];
const EDGE_TYPES = ['factory_cut', 'fuzz', 'whitening', 'chip', 'bleed_into_surface'];
const SURFACE_FACES = ['front', 'back'];
const SURFACE_TYPES = ['print_line', 'scratch', 'dimple', 'indent', 'stain', 'gloss_break'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseScore(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('score not a number');
  return Math.min(10, Math.max(1, Math.round(n)));
}

function parseConfidence(v: unknown): PregradeConfidence {
  if (typeof v === 'string' && CONFIDENCES.includes(v as PregradeConfidence)) {
    return v as PregradeConfidence;
  }
  throw new Error(`bad confidence: ${String(v)}`);
}

function parseSeverity(v: unknown): FindingSeverity {
  if (typeof v === 'string' && SEVERITIES.includes(v as FindingSeverity)) {
    return v as FindingSeverity;
  }
  throw new Error(`bad severity: ${String(v)}`);
}

function parseEnum(v: unknown, allowed: string[], what: string): string {
  if (typeof v === 'string' && allowed.includes(v)) return v;
  throw new Error(`bad ${what}: ${String(v)}`);
}

function parseAttr<F>(
  v: unknown,
  parseFinding: (f: Record<string, unknown>) => F,
): AttributeAssessment<F> {
  if (!isRecord(v)) throw new Error('attribute not an object');
  const confidence = parseConfidence(v.confidence);
  const score = confidence === 'not_assessed' ? null : parseScore(v.score);
  if (confidence !== 'not_assessed' && score === null) {
    throw new Error('assessed attribute missing a score');
  }
  const rawFindings = Array.isArray(v.findings) ? v.findings : [];
  const findings = rawFindings.map((f) => {
    if (!isRecord(f)) throw new Error('finding not an object');
    return parseFinding(f);
  });
  return {
    score,
    confidence,
    borderline: v.borderline === true,
    findings,
  };
}

/**
 * Parse the model's JSON into a DefectAssessment. Throws with a precise
 * reason on any contract violation — the caller feeds that back into
 * the single retry.
 */
export function parseAssessment(raw: unknown): DefectAssessment {
  if (!isRecord(raw)) throw new Error('assessment not an object');
  const corners = parseAttr<CornerFinding>(raw.corners, (f) => ({
    location: parseEnum(f.location, CORNER_LOCS, 'corner location') as CornerFinding['location'],
    type: parseEnum(f.type, CORNER_TYPES, 'corner type') as CornerFinding['type'],
    severity: parseSeverity(f.severity),
    note: typeof f.note === 'string' ? f.note : '',
  }));
  const edges = parseAttr<EdgeFinding>(raw.edges, (f) => ({
    location: parseEnum(f.location, EDGE_LOCS, 'edge location') as EdgeFinding['location'],
    type: parseEnum(f.type, EDGE_TYPES, 'edge type') as EdgeFinding['type'],
    severity: parseSeverity(f.severity),
    note: typeof f.note === 'string' ? f.note : '',
  }));
  const surface = parseAttr<SurfaceFinding>(raw.surface, (f) => ({
    face: parseEnum(f.face, SURFACE_FACES, 'surface face') as SurfaceFinding['face'],
    type: parseEnum(f.type, SURFACE_TYPES, 'surface type') as SurfaceFinding['type'],
    severity: parseSeverity(f.severity),
    note: typeof f.note === 'string' ? f.note : '',
  }));
  const abstain = raw.abstain === true;
  return {
    corners,
    edges,
    surface,
    authenticityFlags: Array.isArray(raw.authenticity_flags)
      ? raw.authenticity_flags.filter((x): x is string => typeof x === 'string')
      : [],
    imageQualityNotes: Array.isArray(raw.image_quality_notes)
      ? raw.image_quality_notes.filter((x): x is string => typeof x === 'string')
      : [],
    abstain,
    abstainReason:
      abstain && typeof raw.abstain_reason === 'string' ? raw.abstain_reason : abstain ? 'Not enough to go on.' : null,
  };
}

/** The abstention every failure path collapses to. */
export function abstention(reason: string): DefectAssessment {
  return {
    corners: { score: null, confidence: 'not_assessed', borderline: false, findings: [] },
    edges: { score: null, confidence: 'not_assessed', borderline: false, findings: [] },
    surface: { score: null, confidence: 'not_assessed', borderline: false, findings: [] },
    authenticityFlags: [],
    imageQualityNotes: [],
    abstain: true,
    abstainReason: reason,
  };
}
