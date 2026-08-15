import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { formatPrice, relativeTime } from '../lib/format';
import { isAcid, sellerDotBackground } from '../lib/face';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { CardFace } from './CardFace';
import './listingcard.css';

export function listingEyebrow(l: ListingWithSeller): string {
  const bits = [GAME_LABELS[l.game], l.setName].filter(Boolean);
  if (l.gradeValue) bits.push(l.gradeValue);
  return bits.join(' · ');
}

/** One-liner under the title: description lead or condition/finish line. */
function oneLinerOf(l: ListingWithSeller): string {
  const d = l.description.trim();
  if (d) return d.split('\n')[0];
  return `${l.condition}${l.language !== 'English' ? ` · ${l.language}` : ''}`;
}

// Grid listing card — the Sleeved design's article card, wired to real
// data: seller dot + handle, ♡ like count, watch star (favorite), title,
// asking/listed columns, Message seller CTA. Every Nth card is acid.
export const ListingCard = memo(function ListingCard({ listing }: { listing: ListingWithSeller }) {
  const { favoriteIds, toggleFavorite, user, client } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const acid = isAcid(listing.id);
  const watched = favoriteIds.has(listing.id);
  const isOwner = user?.id === listing.sellerId;
  const handle = listing.seller.username
    ? `@${listing.seller.username}`
    : listing.seller.displayName;

  const open = () => navigate(`/listing/${listing.id}`);

  const watch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/signin');
      return;
    }
    await toggleFavorite(listing.id);
    toast(watched ? 'Removed from watchlist' : 'Added to watchlist');
  };

  const message = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/signin');
      return;
    }
    try {
      const conv = await client.openConversation(listing.id);
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open the conversation');
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${listing.title}, asking ${formatPrice(listing.price, listing.currency)}`}
      className={`lcard card-raised ${acid ? 'is-acid' : ''}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) open();
      }}
    >
      <div className="lcard-top">
        <div
          className="lcard-dot"
          style={{ background: sellerDotBackground(handle) }}
          aria-hidden="true"
        />
        <div className="lcard-handle">{handle}</div>
        <div className="lcard-likes">♡ {listing.likes}</div>
      </div>

      <div className="lcard-facewrap">
        <CardFace listing={listing} className="lcard-face" onAcid={acid} />
        {listing.status !== 'active' && (
          <div className="lcard-status mono-label">{listing.status}</div>
        )}
        <button
          type="button"
          aria-label={watched ? 'Remove from watchlist' : 'Watch this card'}
          aria-pressed={watched}
          className={`lcard-watch ${watched ? 'lcard-watch-on' : ''}`}
          onClick={(e) => void watch(e)}
        >
          {watched ? '★' : '☆'}
        </button>
      </div>

      <div className="lcard-body">
        <div className="lcard-eyebrow mono-label">{listingEyebrow(listing)}</div>
        <h3 className="lcard-title">{listing.title}</h3>
        <div className="lcard-oneliner">{oneLinerOf(listing)}</div>
        <div className="lcard-stats">
          <div>
            <div className="mono-label lcard-stat-k">Asking</div>
            <div className="mono-value lcard-stat-v">
              {formatPrice(listing.price, listing.currency)}
              {listing.quantity > 1 ? ` ×${listing.quantity}` : ''}
            </div>
          </div>
          <div className="lcard-stat-right">
            <div className="mono-label lcard-stat-k">Listed</div>
            <div className="mono-value lcard-stat-v">{relativeTime(listing.createdAt)}</div>
          </div>
        </div>
        {!isOwner ? (
          <button type="button" className="lcard-cta" onClick={(e) => void message(e)}>
            Message seller
          </button>
        ) : (
          <button
            type="button"
            className="lcard-cta"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/sell/${listing.id}`);
            }}
          >
            Edit listing
          </button>
        )}
      </div>
    </article>
  );
});
