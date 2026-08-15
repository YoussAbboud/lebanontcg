import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main style={{ padding: '72px var(--pad-x)', maxWidth: 480, margin: '0 auto' }}>
      <div className="empty-dashed">
        <h3>Card not found</h3>
        <p>This page doesn&apos;t exist — maybe it was traded away.</p>
        <Link to="/" className="btn-acid">
          Back to home
        </Link>
      </div>
    </main>
  );
}
