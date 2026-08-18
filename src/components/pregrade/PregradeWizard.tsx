import { useState } from 'react';
import type { Shots } from '../../pages/PregradePage';
import { CenteringEditor, type CenteringOutcome } from './CenteringEditor';

/**
 * Post-capture wizard: measure front centering, then back, then the
 * defect assessment and report (next milestones).
 */
export function PregradeWizard({ shots, onBack }: { shots: Shots; onBack(): void }) {
  const [step, setStep] = useState<'center_front' | 'center_back' | 'assess'>('center_front');
  const [front, setFront] = useState<CenteringOutcome | null>(null);
  const [back, setBack] = useState<CenteringOutcome | null>(null);

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

  return (
    <main className="pregrade pregrade-wizard">
      <div className="empty-dashed">
        <h3>Centering measured</h3>
        <p className="mono-value">
          Front {front?.ratios.leftRight[0].toFixed(1)}/{front?.ratios.leftRight[1].toFixed(1)} ·{' '}
          {front?.ratios.topBottom[0].toFixed(1)}/{front?.ratios.topBottom[1].toFixed(1)} → sub-score{' '}
          {front?.score}
        </p>
        <p className="mono-value">
          Back {back?.ratios.leftRight[0].toFixed(1)}/{back?.ratios.leftRight[1].toFixed(1)} ·{' '}
          {back?.ratios.topBottom[0].toFixed(1)}/{back?.ratios.topBottom[1].toFixed(1)} → sub-score{' '}
          {back?.score}
        </p>
        <p>The defect assessment and report land in the next milestones.</p>
        <button type="button" className="btn-outline" onClick={() => setStep('center_back')}>
          ← Back
        </button>
      </div>
    </main>
  );
}
