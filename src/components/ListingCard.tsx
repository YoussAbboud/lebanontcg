import { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { formatPrice } from '../lib/format';
import { useApp } from '../state/AppContext';
import { SlabBadge } from './SlabBadge';
import './listingcard.css';

// Listing card — R2's anatomy (image / micro-label / title / caption) on
// R1's dark surfaces, with the slab badge from R3 for graded cards.
export const ListingCard = memo(function ListingCard({ listing }: { listing: ListingWithSeller }) {
  const { favoriteIds, toggleFavorite, user } = useApp();
  const navigate = useNavigate();
  const cover = listing.images[0];
  const favorited = favoriteIds.has(listing.id);

  return (
    <article className="lcard card-surface">
      <Link
        to={`/listing/${listing.id}`}
        className="lcard-link"
        aria-label={`${listing.title}, ${formatPrice(listing.price, listing.currency)}`}
      >
        <div className="lcard-media">
          {cover ? (
            <img src={cover.url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="lcard-noimage" aria-hidden="true" />
          )}
          {listing.gradeValue && (
            <div className="lcard-slab">
              <SlabBadge company={listing.gradeCompany} grade={listing.gradeValue} />
            </div>
          )}
          {listing.status !== 'active' && (
            <span className={`badge badge-${listing.status} lcard-status`}>{listing.status}</span>
          )}
        </div>
        <div className="lcard-body">
          <p className="lcard-game microlabel">
            <span className="game-dot" data-game={listing.game} aria-hidden="true" />
            {GAME_LABELS[listing.game]}
          </p>
          <h3 className="lcard-title">{listing.title}</h3>
          <p className="lcard-set">
            {listing.setName}
            {listing.cardNumber && listing.cardNumber !== '—' ? ` · ${listing.cardNumber}` : ''}
          </p>
          <div className="lcard-foot">
            <span className={`badge badge-cond-${listing.condition}`}>{listing.condition}</span>
            <span className="price lcard-price">
              {formatPrice(listing.price, listing.currency)}
              {listing.quantity > 1 && (
                <span className="lcard-qty"> ×{listing.quantity}</span>
              )}
            </span>
          </div>
        </div>
      </Link>
      <button
        className="lcard-fav"
        aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={favorited}
        onClick={() => {
          if (!user) {
            navigate('/signin');
            return;
          }
          void toggleFavorite(listing.id);
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M12 21s-7.5-4.7-10-9.3C.3 8.6 2 4.5 5.8 4.1c2.2-.2 4 .9 5 2.5.2.4.4.4.6 0 1-1.6 2.8-2.7 5-2.5 3.7.4 5.4 4.5 3.7 7.6C19.5 16.3 12 21 12 21z"
            fill={favorited ? 'var(--lime)' : 'none'}
            stroke={favorited ? 'var(--lime)' : 'currentColor'}
            strokeWidth="2"
          />
        </svg>
      </button>
    </article>
  );
});
