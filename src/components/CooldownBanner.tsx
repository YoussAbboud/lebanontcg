import { useEffect } from 'react';
import { formatWait } from '../lib/format';
import { useNow } from '../lib/useNow';

/** "You can't list at the moment" with a live countdown (0032). Ticks on
    its own so the page around it doesn't re-render every second. */
export function CooldownBanner({ until, onDone }: { until: number; onDone(): void }) {
  const now = useNow(1000);
  const left = Math.ceil((until - now) / 1000);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  if (left <= 0) return null;
  return (
    <div className="sell-cooldown" role="status">
      <strong>You can&apos;t list at the moment. Try again in {formatWait(left)}.</strong>
      <p>
        Your last listings were held for review because their photos didn&apos;t look like
        trading cards. Listings need photos of the actual card.
      </p>
    </div>
  );
}
