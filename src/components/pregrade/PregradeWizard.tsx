import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import type { Shot, Shots } from '../../pages/PregradePage';
import type { Listing } from '../../lib/types';
import { CenteringEditor, type CenteringOutcome } from './CenteringEditor';
import { PregradeReportView } from './PregradeReportView';
import { EvPanel } from './EvPanel';
import { prepareAssessmentImages } from '../../lib/pregrade/assessPrep';
import { estimateGrade } from '../../lib/pregrade/estimate';
import type {
  CaptureSlot,
  DefectAssessment,
  Estimate,
  PregradeReport,
} from '../../lib/pregrade/types';

export interface WizardResult {
  front: CenteringOutcome;
  back: CenteringOutcome;
  assessment: DefectAssessment;
  estimate: Estimate;
  hasRake: boolean;
}

/**
 * Post-capture wizard: measure front centering, then back, then run the
 * defect assessment and derive the estimate. The report view (next
 * milestone) renders the result.
 */
export function PregradeWizard({
  shots,
  allPassedQuality,
  onBack,
}: {
  shots: Shots;
  /** False when any accepted shot was a quality-gate override. */
  allPassedQuality: boolean;
  onBack(): void;
}) {
  const { client } = useApp();
  const location = useLocation();
  const [step, setStep] = useState<'center_front' | 'center_back' | 'assess'>('center_front');
  const [front, setFront] = useState<CenteringOutcome | null>(null);
  const [back, setBack] = useState<CenteringOutcome | null>(null);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [assessError, setAssessError] = useState<string | null>(null);

  const caseHint = new URLSearchParams(location.search).get('case') ?? undefined;

  // Run the assessment once both faces are measured.
  useEffect(() => {
    if (step !== 'assess' || !front || !back || result) return;
    let cancelled = false;
    (async () => {
      setAssessError(null);
      const { images, hasRake } = await prepareAssessmentImages(shots);
      const assessment = await client.assessPregrade({ images, hasRake, caseHint });
      if (cancelled) return;
      const estimate = estimateGrade({
        centering: front.score,
        corners: assessment.corners.score,
        edges: assessment.edges.score,
        surface: assessment.surface.confidence === 'not_assessed' ? null : assessment.surface.score,
        assessment,
        era: 'ultra_modern',
        centeringMethod: front.method,
        allImagesPassedQuality: allPassedQuality,
      });
      setResult({ front, back, assessment, estimate, hasRake });
    })().catch((err) => {
      if (!cancelled) setAssessError(err instanceof Error ? err.message : 'Assessment failed.');
    });
    return () => {
      cancelled = true;
    };
  }, [step, front, back, result, shots, client, caseHint, allPassedQuality]);

  if (step === 'center_front') {
    return (
      <main className="pregrade pregrade-wizard">
        <CenteringEditor
          face="front"
          blob={shots.front!.blob}
          flattened={shots.front!.flattened}
          onBack={onBack}
          onDone={(r) => {
            setFront(r);
            setStep('center_back');
          }}
        />
      </main>
    );
  }

  if (step === 'center_back') {
    return (
      <main className="pregrade pregrade-wizard">
        <CenteringEditor
          face="back"
          blob={shots.back!.blob}
          flattened={shots.back!.flattened}
          onBack={() => setStep('center_front')}
          onDone={(r) => {
            setBack(r);
            setStep('assess');
          }}
        />
      </main>
    );
  }

  if (assessError) {
    return (
      <main className="pregrade pregrade-wizard">
        <div className="empty-dashed" role="alert">
          <h3>Assessment didn&apos;t run</h3>
          <p>{assessError}</p>
          <button type="button" className="btn-outline" onClick={() => setAssessError(null)}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="pregrade pregrade-wizard">
        <div className="empty-dashed" aria-busy="true">
          <h3>Reading the photos…</h3>
          <p>Corners, edges{shots.rake_front || shots.rake_back ? ', surface' : ''} — this takes a
            few seconds.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pregrade pregrade-wizard">
      <PregradeReportView
        data={{
          front: {
            ...result.front,
            imageUrl: shots.front!.url,
            flattened: shots.front!.flattened,
          },
          back: {
            ...result.back,
            imageUrl: shots.back!.url,
            flattened: shots.back!.flattened,
          },
          assessment: result.assessment,
          estimate: result.estimate,
          captures: Object.fromEntries(
            (Object.entries(shots) as [CaptureSlot, Shot | undefined][])
              .filter(([, s]) => s)
              .map(([slot, s]) => [slot, s!.url]),
          ),
        }}
      />
      <EvPanel estimate={result.estimate} />
      <PublishPanel result={result} shots={shots} />
      {result.estimate.isCeiling && (
        <div className="pregrade-ceiling-cta">
          <button type="button" className="btn-acid" onClick={onBack}>
            ← Shoot the raking-light photos
          </button>
        </div>
      )}
    </main>
  );
}

/**
 * Save the report, then (opt-in, per listing) attach and publish it to
 * one of the seller's own listings. Publishing attaches the full photo
 * set and the measured numbers so a buyer can check the work; the
 * perceptual-hash gate blocks attaching to a different card's listing.
 */
function PublishPanel({ result, shots }: { result: WizardResult; shots: Shots }) {
  const { client, user } = useApp();
  const [report, setReport] = useState<PregradeReport | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [target, setTarget] = useState('');
  const [publishState, setPublishState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);

  // Save once (the estimate is the seller's private result by default).
  useEffect(() => {
    if (report) return;
    let cancelled = false;
    const captures = (Object.entries(shots) as [CaptureSlot, Shot][])
      .filter(([, s]) => s)
      .map(([slot, s]) => ({ slot, blob: s.blob }));
    client
      .savePregradeReport({
        era: 'ultra_modern',
        centeringMethod: result.front.method,
        front: result.front.ratios,
        back: result.back.ratios,
        scores: {
          centering: result.front.score,
          corners: result.assessment.corners.score,
          edges: result.assessment.edges.score,
          surface:
            result.assessment.surface.confidence === 'not_assessed'
              ? null
              : result.assessment.surface.score,
        },
        estimate: result.estimate,
        assessment: result.assessment,
        captures,
        diagram: {
          front: result.front.guides,
          back: result.back.guides,
          frontFlattened: shots.front?.flattened ?? false,
          backFlattened: shots.back?.flattened ?? false,
        },
      })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => {
        if (!cancelled) setSaveError(err instanceof Error ? err.message : 'Could not save.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save exactly once
  }, []);

  useEffect(() => {
    if (!user) return;
    void client
      .getListingsBySeller(user.id, ['active', 'reserved'])
      .then(setListings)
      .catch(() => setListings([]));
  }, [client, user]);

  const publish = async () => {
    if (!report || !target) return;
    setPublishState('busy');
    setPublishError(null);
    try {
      await client.publishPregradeReport(report.id, target);
      setPublishState('done');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publishing failed.');
      setPublishState('idle');
    }
  };

  return (
    <section className="pgpublish panel" aria-label="Save and publish">
      {saveError ? (
        <p className="field-error" role="alert">{saveError}</p>
      ) : !report ? (
        <p className="mono-label">Saving your report…</p>
      ) : (
        <>
          <p className="pgpublish-done mono-label">Report saved to your account ✓</p>
          {publishState === 'done' ? (
            <p className="pgpublish-done">
              Published to the listing — buyers now see the measured numbers and the full photo
              set.
            </p>
          ) : (
            <>
              <p className="pgpublish-note">
                Estimates stay private to you. Publishing onto one of your listings is opt-in —
                it attaches the photos and the measured numbers so a buyer can check the work.
              </p>
              <div className="pgpublish-row">
                <select
                  className="input"
                  aria-label="Attach to listing"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Attach to a listing…</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!target || publishState === 'busy'}
                  onClick={() => void publish()}
                >
                  {publishState === 'busy' ? 'Checking…' : 'Publish to listing'}
                </button>
              </div>
              {publishError && (
                <p className="field-error" role="alert">{publishError}</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
