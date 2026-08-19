import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { formatPrice, relativeTime } from '../lib/format';
import { auctionPillLabel, isEffectivelyOver } from '../lib/auction';
import { useNow } from '../lib/useNow';
import { sellerDotBackground } from '../lib/face';
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
// asking/listed columns, Message seller CTA. The acid treatment is the
// hover/press state (CSS); `pinned` keeps one card permanently acid with
// a breathing glow (the home page pins its most-liked card).
export const ListingCard = memo(function ListingCard({
  listing,
  pinned = false,
}: {
  listing: ListingWithSeller;
  pinned?: boolean;
}) {
  const { favoriteIds, toggleFavorite, user, client } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const watched = favoriteIds.has(listing.id);
  const isOwner = user?.id === listing.sellerId;
  const handle = listing.seller.username
    ? `@${listing.seller.username}`
    : listing.seller.displayName;

  const auction = listing.auction ?? null;
  // Tick the pill countdown once a minute; compute-from-target keeps it
  // honest after background throttling.
  const now = useNow(30_000);
  const live = Boolean(auction && !isEffectivelyOver(auction, now));
  const livePill = auction ? auctionPillLabel(auction, now) : null;

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
      aria-label={`${listing.title}, ${live ? 'current bid' : 'asking'} ${formatPrice(listing.price, listing.currency)}`}
      className={`lcard card-raised ${pinned || live ? 'is-acid' : ''}`}
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
        <CardFace listing={listing} className="lcard-face" />
        {listing.status !== 'active' && (
          <div className="lcard-status mono-label">{listing.status}</div>
        )}
        {live && livePill && <div className="lcard-live mono-label">{livePill}</div>}
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
        <div className="lcard-eyebrow mono-label">
          {listingEyebrow(listing)}
          {listing.pregradePill && !listing.gradeValue && (
            <span className="lcard-pregrade mono-label" title="Pre-grade estimate — not a grade">
              {listing.pregradePill}
            </span>
          )}
        </div>
        <h3 className="lcard-title">{listing.title}</h3>
        <div className="lcard-oneliner">{oneLinerOf(listing)}</div>
        <div className="lcard-stats">
          <div>
            <div className="mono-label lcard-stat-k">{live ? 'Current bid' : 'Asking'}</div>
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
        {!isOwner && live ? (
          <button
            type="button"
            className="lcard-cta"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            Place a bid
          </button>
        ) : !isOwner ? (
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
