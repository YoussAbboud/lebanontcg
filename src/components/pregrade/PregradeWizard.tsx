import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import type { Shots } from '../../pages/PregradePage';
import { CenteringEditor, type CenteringOutcome } from './CenteringEditor';
import { PregradeReportView } from './PregradeReportView';
import { EvPanel } from './EvPanel';
import { prepareAssessmentImages } from '../../lib/pregrade/assessPrep';
import { estimateGrade } from '../../lib/pregrade/estimate';
import type { DefectAssessment, Estimate } from '../../lib/pregrade/types';

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
export function PregradeWizard({ shots, onBack }: { shots: Shots; onBack(): void }) {
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
        allImagesPassedQuality: true,
      });
      setResult({ front, back, assessment, estimate, hasRake });
    })().catch((err) => {
      if (!cancelled) setAssessError(err instanceof Error ? err.message : 'Assessment failed.');
    });
    return () => {
      cancelled = true;
    };
  }, [step, front, back, result, shots, client, caseHint]);

  if (step === 'center_front') {
    return (
      <main className="pregrade pregrade-wizard">
        <CenteringEditor
          face="front"
          blob={shots.front!.blob}
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
          front: result.front,
          back: result.back,
          assessment: result.assessment,
          estimate: result.estimate,
        }}
      />
      <EvPanel estimate={result.estimate} />
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
