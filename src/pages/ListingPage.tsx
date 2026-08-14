import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ListingStatus, ListingWithSeller } from '../lib/types';
import {
  CONDITION_LABELS,
  FINISH_LABELS,
  GAME_LABELS,
} from '../lib/types';
import { allowedTransitions, STATUS_LABELS } from '../lib/status';
import { formatPrice, memberSince, relativeTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { Avatar } from '../components/Avatar';
import { SlabBadge } from '../components/SlabBadge';
import { Gallery } from '../components/Gallery';
import { RatingStars } from '../components/RatingStars';
import { ReportDialog } from '../components/ReportDialog';
import './listing.css';

type LoadState = 'loading' | 'ready' | 'error' | 'missing';

export function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const { client, user, favoriteIds, toggleFavorite } = useApp();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setState('loading');
    try {
      const l = await client.getListing(id);
      if (!l) {
        setState('missing');
        return;
      }
      setListing(l);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live status/price updates (e.g. seller marks sold from another tab).
  useEffect(() => {
    if (!id) return;
    return client.subscribeToListing(id, (updated) => {
      setListing((prev) => (prev ? { ...prev, ...updated, seller: prev.seller } : prev));
    });
  }, [client, id]);

  if (state === 'loading') {
    return (
      <div className="ldetail" aria-busy="true">
        <div className="skeleton ldetail-skel-media" />
        <div className="ldetail-skel-side">
          <div className="skeleton" style={{ height: 32 }} />
          <div className="skeleton" style={{ height: 96 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Listing not found</h3>
        <p>It may have been removed by the seller.</p>
        <Link to="/" className="btn btn-primary">Back to browse</Link>
      </div>
    );
  }

  if (state === 'error' || !listing) {
    return (
      <div className="empty-state" role="alert">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Couldn&apos;t load this listing</h3>
        <button className="btn btn-primary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  const isOwner = user?.id === listing.sellerId;
  const favorited = favoriteIds.has(listing.id);

  const changeStatus = async (status: ListingStatus) => {
    setBusy(true);
    setActionError(null);
    try {
      await client.setListingStatus(listing.id, status);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setBusy(false);
    }
  };

  const messageSeller = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const conv = await client.openConversation(listing.id);
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open the conversation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ldetail">
      <Gallery images={listing.images} title={listing.title} />

      <div className="ldetail-side">
        <div className="ldetail-head">
          <p className="microlabel ldetail-game">
            <span className="game-dot" data-game={listing.game} aria-hidden="true" />
            {GAME_LABELS[listing.game]}
            <span className={`badge badge-${listing.status}`}>{STATUS_LABELS[listing.status]}</span>
          </p>
          <h1 className="ldetail-title display">{listing.title}</h1>
          <p className="ldetail-setline">
            {listing.setName}
            {listing.cardNumber && listing.cardNumber !== '—' ? ` · ${listing.cardNumber}` : ''}
            {` · ${listing.language}`}
          </p>
        </div>

        <div className="ldetail-price-row">
          <span className="price ldetail-price">{formatPrice(listing.price, listing.currency)}</span>
          {listing.quantity > 1 && (
            <span className="ldetail-qty">{listing.quantity} available</span>
          )}
        </div>

        <dl className="ldetail-specs card-surface">
          <div>
            <dt className="microlabel">Condition</dt>
            <dd>
              <span className={`badge badge-cond-${listing.condition}`}>{listing.condition}</span>
              <span className="ldetail-spec-note">{CONDITION_LABELS[listing.condition]}</span>
            </dd>
          </div>
          <div>
            <dt className="microlabel">Finish</dt>
            <dd>{FINISH_LABELS[listing.finish]}</dd>
          </div>
          <div>
            <dt className="microlabel">Grade</dt>
            <dd>
              {listing.gradeValue ? (
                <SlabBadge company={listing.gradeCompany} grade={listing.gradeValue} />
              ) : (
                <span className="ldetail-spec-muted">Ungraded (raw)</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="microlabel">Listed</dt>
            <dd>{relativeTime(listing.createdAt)}</dd>
          </div>
        </dl>

        {listing.description && (
          <div className="ldetail-desc">
            <h2 className="microlabel">Seller&apos;s notes</h2>
            <p>{listing.description}</p>
          </div>
        )}

        {actionError && (
          <p className="field-error" role="alert">{actionError}</p>
        )}

        {isOwner ? (
          <div className="ldetail-owner card-surface">
            <p className="microlabel">Your listing</p>
            <div className="ldetail-owner-actions">
              {(listing.status === 'active' || listing.status === 'reserved') && (
                <Link to={`/sell/${listing.id}`} className="btn btn-ghost">Edit</Link>
              )}
              {allowedTransitions(listing.status).map((s) => (
                <button
                  key={s}
                  className={
                    s === 'sold' ? 'btn btn-primary' : s === 'removed' ? 'btn btn-danger' : 'btn btn-quiet'
                  }
                  disabled={busy}
                  onClick={() => void changeStatus(s)}
                >
                  {s === 'active'
                    ? listing.status === 'removed' ? 'Relist' : 'Unreserve'
                    : s === 'reserved' ? 'Mark reserved'
                    : s === 'sold' ? 'Mark sold'
                    : 'Remove'}
                </button>
              ))}
            </div>
            {listing.status === 'sold' && (
              <p className="ldetail-owner-note">Sold listings are final — conversations and reviews stay attached.</p>
            )}
          </div>
        ) : (
          <div className="ldetail-cta">
            <button
              className="btn btn-primary btn-lg ldetail-msg"
              disabled={busy || listing.status === 'sold' || listing.status === 'removed'}
              onClick={() => void messageSeller()}
            >
              {listing.status === 'sold' ? 'Sold' : listing.status === 'removed' ? 'Unavailable' : 'Message seller'}
            </button>
            <button
              className="btn btn-ghost btn-lg"
              aria-pressed={favorited}
              onClick={() => {
                if (!user) {
                  navigate('/signin');
                  return;
                }
                void toggleFavorite(listing.id);
              }}
            >
              {favorited ? '♥ Favorited' : '♡ Favorite'}
            </button>
          </div>
        )}

        <section className="ldetail-seller card-surface" aria-label="Seller">
          <Link
            to={listing.seller.username ? `/u/${listing.seller.username}` : '#'}
            className="ldetail-seller-id"
          >
            <Avatar profile={listing.seller} size={44} />
            <span>
              <strong>{listing.seller.displayName}</strong>
              <span className="ldetail-seller-handle">
                {listing.seller.username ? `@${listing.seller.username}` : ''}
              </span>
            </span>
          </Link>
          <div className="ldetail-seller-meta">
            <RatingStars avg={listing.seller.ratingAvg} count={listing.seller.ratingCount} />
            <span>Member since {memberSince(listing.seller.createdAt)}</span>
            <span>
              {listing.sellerActiveListingCount} active listing
              {listing.sellerActiveListingCount === 1 ? '' : 's'}
            </span>
          </div>
          {!isOwner && (
            <button className="ldetail-report" onClick={() => setReportOpen(true)}>
              Report this listing
            </button>
          )}
        </section>
      </div>

      {reportOpen && (
        <ReportDialog
          targetType="listing"
          targetId={listing.id}
          targetLabel={listing.title}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
