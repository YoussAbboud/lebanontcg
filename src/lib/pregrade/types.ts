// Domain types for the Pre-Grade estimator. Shared by the pure math
// modules, both MarketplaceClient implementations, and the UI.
//
// Language note (non-negotiable): this feature produces ESTIMATES.
// Nothing in here may ever write to listings.gradeCompany /
// listings.gradeValue — those stay reserved for real, cert-numbered
// slabs. See supabase/migrations/0011 and pregrade/leak.test.ts.

export type Era = 'ultra_modern' | 'modern' | 'vintage';
export type PregradeConfidence = 'high' | 'moderate' | 'low' | 'not_assessed';
export type Recommendation = 'submit' | 'marginal' | 'do_not_submit' | 'inconclusive';
export type CenteringMethod = 'border_detect' | 'manual' | 'design_element';

export type CaptureSlot =
  | 'front'
  | 'back'
  | 'corner_tl'
  | 'corner_tr'
  | 'corner_br'
  | 'corner_bl'
  | 'rake_front'
  | 'rake_back';

export const CAPTURE_SLOTS: CaptureSlot[] = [
  'front',
  'back',
  'corner_tl',
  'corner_tr',
  'corner_br',
  'corner_bl',
  'rake_front',
  'rake_back',
];

export const REQUIRED_SLOTS: CaptureSlot[] = [
  'front',
  'back',
  'corner_tl',
  'corner_tr',
  'corner_br',
  'corner_bl',
];

export type FindingSeverity = 'trace' | 'minor' | 'moderate' | 'severe';

export interface CornerFinding {
  location: 'top_left' | 'top_right' | 'bottom_right' | 'bottom_left';
  type: 'soft' | 'ding' | 'whitening' | 'fray' | 'round';
  severity: FindingSeverity;
  note: string;
}

export interface EdgeFinding {
  location: 'top' | 'right' | 'bottom' | 'left';
  type: 'factory_cut' | 'fuzz' | 'whitening' | 'chip' | 'bleed_into_surface';
  severity: FindingSeverity;
  note: string;
}

export interface SurfaceFinding {
  face: 'front' | 'back';
  type: 'print_line' | 'scratch' | 'dimple' | 'indent' | 'stain' | 'gloss_break';
  severity: FindingSeverity;
  note: string;
}

export interface AttributeAssessment<F> {
  /** 1–10, or null when the attribute could not be judged. */
  score: number | null;
  confidence: PregradeConfidence;
  /** True when a real submission in this state could still gem. */
  borderline: boolean;
  findings: F[];
}

/** The defect-assessment contract (validated model output, or canned mock). */
export interface DefectAssessment {
  corners: AttributeAssessment<CornerFinding>;
  edges: AttributeAssessment<EdgeFinding>;
  surface: AttributeAssessment<SurfaceFinding>;
  authenticityFlags: string[];
  imageQualityNotes: string[];
  abstain: boolean;
  abstainReason: string | null;
}

/** One axis measured as [larger, smaller] percentages, e.g. [54.5, 45.5]. */
export type AxisRatio = [number, number];

export interface CenteringResult {
  method: CenteringMethod;
  front: { leftRight: AxisRatio; topBottom: AxisRatio };
  /** Null when the back was measured by design-element proxy only. */
  back: { leftRight: AxisRatio; topBottom: AxisRatio } | null;
  score: number;
  backScore: number | null;
}

export interface GradeBand {
  p10: number;
  p9: number;
  p8: number;
  pLow: number;
}

export interface EstimateInput {
  centering: number | null;
  corners: number | null;
  edges: number | null;
  /** Null = surface not assessed (no raking-light shots). */
  surface: number | null;
  assessment: DefectAssessment | null;
  era: Era;
  centeringMethod: CenteringMethod;
  /** True when every accepted capture passed its quality gate. */
  allImagesPassedQuality: boolean;
}

export interface Estimate {
  /** min() of assessed attributes after modifiers. */
  base: number;
  /** True when surface was unassessed: base is a ceiling, not an estimate. */
  isCeiling: boolean;
  band: GradeBand;
  borderlineFlags: number;
  confidence: 'high' | 'moderate' | 'low';
  recommendation: Recommendation;
  /** Human-ordered notes explaining caps and modifiers that fired. */
  notes: string[];
}

export interface PregradeReport {
  id: string;
  userId: string;
  listingId: string | null;
  published: boolean;
  standardsVersion: string;
  era: Era;
  centeringMethod: CenteringMethod;
  front: { leftRight: AxisRatio; topBottom: AxisRatio };
  back: { leftRight: AxisRatio; topBottom: AxisRatio } | null;
  scoreCentering: number | null;
  scoreCorners: number | null;
  scoreEdges: number | null;
  scoreSurface: number | null;
  base: number;
  isCeiling: boolean;
  band: GradeBand;
  confidence: 'high' | 'moderate' | 'low';
  recommendation: Recommendation;
  assessment: DefectAssessment;
  notes: string[];
  modelId: string | null;
  createdAt: string;
  /** Reported real-world outcome, when the seller came back with one. */
  outcome: { actualGrade: number; certNumber: string | null; reportedAt: string } | null;
  captures: Partial<Record<CaptureSlot, string>>;
}

export interface PregradeReportInput {
  era: Era;
  centeringMethod: CenteringMethod;
  front: { leftRight: AxisRatio; topBottom: AxisRatio };
  back: { leftRight: AxisRatio; topBottom: AxisRatio } | null;
  scores: {
    centering: number | null;
    corners: number | null;
    edges: number | null;
    surface: number | null;
  };
  estimate: Estimate;
  assessment: DefectAssessment;
  captures: { slot: CaptureSlot; blob: Blob }[];
}

export interface TrackRecord {
  bucketCount: number;
  p10Rate: number;
}

/** The plain-language disclaimer every estimate-bearing surface shows. */
export const PREGRADE_DISCLAIMER =
  'Estimated by LebanonTCG from seller photos. Not affiliated with PSA. Only PSA can grade a card.';
