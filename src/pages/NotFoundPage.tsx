import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="empty-state">
      <div className="empty-glyph" aria-hidden="true" />
      <h3 className="display">Card not found</h3>
      <p>This page doesn&apos;t exist — maybe it was traded away.</p>
      <Link to="/" className="btn btn-primary">
        Back to browse
      </Link>
    </div>
  );
}
