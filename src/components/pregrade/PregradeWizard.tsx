import type { Shots } from '../../pages/PregradePage';

/**
 * Post-capture wizard: centering measurement, defect assessment, the
 * report. Filled in by the following milestones — the capture flow
 * hands accepted shots in here.
 */
export function PregradeWizard({ shots, onBack }: { shots: Shots; onBack(): void }) {
  return (
    <main className="pregrade">
      <div className="empty-dashed">
        <h3>Centering measurement</h3>
        <p>
          {Object.keys(shots).length} shots accepted. The centering step lands in the next
          milestone.
        </p>
        <button type="button" className="btn-outline" onClick={onBack}>
          ← Back to capture
        </button>
      </div>
    </main>
  );
}
