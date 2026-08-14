// Temporary milestone scaffolding — every stub is replaced by a real page
// in M2–M5. Styled from tokens so even the skeleton app looks like Cardpost.
export function PageStub({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-glyph" aria-hidden="true" />
      <h3 className="display">{title}</h3>
      <p>This page arrives in milestone {milestone}.</p>
    </div>
  );
}
