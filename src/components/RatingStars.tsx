import './ratingstars.css';

/** Compact star rating: lime stars (R2's value color) + count. */
export function RatingStars({
  avg,
  count,
  showCount = true,
}: {
  avg: number | null;
  count: number;
  showCount?: boolean;
}) {
  if (avg === null || count === 0) {
    return <span className="stars stars-none">No ratings yet</span>;
  }
  const pct = Math.round((avg / 5) * 100);
  return (
    <span className="stars" aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} reviews`}>
      <span className="stars-track" aria-hidden="true">
        <span className="stars-glyphs">★★★★★</span>
        <span className="stars-fill" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
      <strong>{avg.toFixed(1)}</strong>
      {showCount && <span className="stars-count">({count})</span>}
    </span>
  );
}
