import {
  AUTHENTICITY_NOTE,
  bandLabel,
  cornerSentence,
  edgeSentence,
  INDENT_WARNING,
  PRIOR_NOTE,
  RECOMMENDATION_LABELS,
  SURFACE_NOT_CHECKED,
  surfaceSentence,
  trackRecordSentence,
} from '../../lib/pregrade/copy';
import { CALIBRATION, calibrationKey } from '../../lib/pregrade/estimate';
import type { Era } from '../../lib/pregrade/types';
import { PREGRADE_DISCLAIMER, type DefectAssessment, type Estimate } from '../../lib/pregrade/types';
import { CenteringDiagram, type DiagramBorders } from './CenteringDiagram';
import type { AxisRatio } from '../../lib/pregrade/types';

export interface ReportViewData {
  front: {
    ratios: { leftRight: AxisRatio; topBottom: AxisRatio };
    score: number;
    borders: DiagramBorders;
  };
  back: {
    ratios: { leftRight: AxisRatio; topBottom: AxisRatio };
    score: number;
    borders: DiagramBorders;
  } | null;
  assessment: DefectAssessment;
  estimate: Estimate;
  era?: Era;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** ≥30 real outcomes in the bucket → the measured track record; else the
    probabilities are labelled as the priors they are. */
function calibrationLine(e: Estimate, era: Era): string {
  const count = CALIBRATION.counts?.[calibrationKey(e.base, e.borderlineFlags, era)] ?? 0;
  if (CALIBRATION.measured && count >= 30) {
    return trackRecordSentence(count, e.band.p10);
  }
  return PRIOR_NOTE;
}

/** The full pre-grade report: band, sub-scores, findings, honesty. */
export function PregradeReportView({ data }: { data: ReportViewData }) {
  const { assessment: a, estimate: e, front, back } = data;
  const hasIndent = a.surface.findings.some((f) => f.type === 'indent');
  const surfaceAssessed = a.surface.confidence !== 'not_assessed';
  const abstained = a.abstain;

  const subscores: Array<[string, number | null, boolean]> = [
    ['Centering', abstained ? null : front.score, false],
    ['Corners', a.corners.score, a.corners.borderline],
    ['Edges', a.edges.score, a.edges.borderline],
    ['Surface', a.surface.score, a.surface.borderline],
  ];

  return (
    <section className="pgreport panel" aria-label="Pre-grade report">
      <header className="pgreport-head">
        <div className="mono-label pgreport-eyebrow">Pre-Grade report</div>
        <h2 className="display pgreport-band">{bandLabel(e)}</h2>
        <div
          className={`pgreport-rec mono-label is-${e.recommendation}`}
          data-recommendation={e.recommendation}
        >
          {RECOMMENDATION_LABELS[e.recommendation]}
        </div>
        <p className="mono-label pgreport-disclaimer">{PREGRADE_DISCLAIMER}</p>
      </header>

      {hasIndent && (
        <div className="pgreport-indent" role="alert">
          {INDENT_WARNING}
        </div>
      )}

      {abstained ? (
        <p className="pgreport-abstain">{a.abstainReason}</p>
      ) : (
        <>
          {!e.isCeiling && (
            <>
              <div className="pgreport-band-row mono-value">
                <span>P(10) {pct(e.band.p10)}</span>
                <span>P(9) {pct(e.band.p9)}</span>
                <span>P(8) {pct(e.band.p8)}</span>
                <span>P(≤7) {pct(e.band.pLow)}</span>
              </div>
              <p className="mono-label pgreport-calibration">
                {calibrationLine(e, data.era ?? 'ultra_modern')}
              </p>
            </>
          )}

          <div className="pgreport-scores">
            {subscores.map(([label, score, borderline]) => (
              <div key={label} className="pgreport-score">
                <span className="mono-label">{label}</span>
                <strong className="display">{score ?? '—'}</strong>
                {borderline && <span className="mono-label pgreport-borderline">borderline</span>}
              </div>
            ))}
          </div>

          <div className="pgreport-centering">
            <div className="pgreport-diagram">
              <CenteringDiagram
                borders={front.borders}
                leftRight={front.ratios.leftRight}
                topBottom={front.ratios.topBottom}
              />
              <span className="mono-label">
                Front {front.ratios.leftRight[0]}/{front.ratios.leftRight[1]} ·{' '}
                {front.ratios.topBottom[0]}/{front.ratios.topBottom[1]}
              </span>
            </div>
            {back && (
              <div className="pgreport-diagram">
                <CenteringDiagram
                  borders={back.borders}
                  leftRight={back.ratios.leftRight}
                  topBottom={back.ratios.topBottom}
                />
                <span className="mono-label">
                  Back {back.ratios.leftRight[0]}/{back.ratios.leftRight[1]} ·{' '}
                  {back.ratios.topBottom[0]}/{back.ratios.topBottom[1]}
                </span>
              </div>
            )}
          </div>

          {!surfaceAssessed && <p className="pgreport-notchecked">{SURFACE_NOT_CHECKED}</p>}

          <ul className="pgreport-findings">
            {a.corners.findings.map((f, i) => (
              <li key={`c${i}`}>
                <span>{cornerSentence(f)}</span>
                {f.note && <em>{f.note}</em>}
                <span className="mono-label pgreport-from">from the corner macros</span>
              </li>
            ))}
            {a.edges.findings.map((f, i) => (
              <li key={`e${i}`}>
                <span>{edgeSentence(f)}</span>
                {f.note && <em>{f.note}</em>}
                <span className="mono-label pgreport-from">from the edge strips</span>
              </li>
            ))}
            {a.surface.findings.map((f, i) => (
              <li key={`s${i}`} className={f.type === 'indent' ? 'is-indent' : ''}>
                <span>{surfaceSentence(f)}</span>
                {f.note && <em>{f.note}</em>}
                <span className="mono-label pgreport-from">from the raking-light shots</span>
              </li>
            ))}
            {a.corners.findings.length + a.edges.findings.length + a.surface.findings.length ===
              0 && <li>Nothing worth flagging in the photos provided.</li>}
          </ul>

          {e.notes.length > 0 && (
            <ul className="pgreport-notes">
              {e.notes.map((n) => (
                <li key={n} className="mono-label">
                  {n}
                </li>
              ))}
            </ul>
          )}

          {a.authenticityFlags.length > 0 && (
            <p className="pgreport-auth mono-label">{AUTHENTICITY_NOTE}</p>
          )}
          {a.imageQualityNotes.length > 0 && (
            <p className="pgreport-imgnotes mono-label">{a.imageQualityNotes.join(' · ')}</p>
          )}
        </>
      )}
    </section>
  );
}
