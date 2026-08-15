import type { ListingWithSeller } from '../lib/types';
import { ListingCard } from './ListingCard';
import './listingcarousel.css';

/**
 * Auto-scrolling card rail (R4). The track holds the list twice and
 * translates -50% in a loop, so the scroll is seamless; hover pauses it,
 * and prefers-reduced-motion turns it into a plain scrollable row.
 */
export function ListingCarousel({ items }: { items: ListingWithSeller[] }) {
  if (items.length === 0) return null;
  return (
    <div className="lrail" aria-label="Featured listings">
      <div className="lrail-track" style={{ ['--rail-items' as string]: items.length }}>
        {[0, 1].map((copy) => (
          <div
            className="lrail-group"
            key={copy}
            aria-hidden={copy === 1 || undefined}
            // The clone is purely visual — keep it out of the tab order.
            {...(copy === 1 ? { inert: '' as unknown as boolean } : {})}
          >
            {items.map((l) => (
              <div className="lrail-item" key={`${copy}-${l.id}`}>
                <ListingCard listing={l} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
