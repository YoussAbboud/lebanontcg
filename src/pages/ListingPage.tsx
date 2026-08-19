import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ListingStatus, ListingWithSeller } from '../lib/types';
import { CONDITION_LABELS, FINISH_LABELS, GAME_LABELS } from '../lib/types';
import { allowedTransitions, STATUS_LABELS } from '../lib/status';
import { avatarBackground, faceBackground, glyphOf } from '../lib/face';
import { formatPrice, memberSince } from '../lib/format';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { Avatar } from '../components/Avatar';
import { ReportDialog } from '../components/ReportDialog';
import { PregradeListingPanel } from '../components/pregrade/PregradeListingPanel';
import { ImageLightbox } from '../components/ImageLightbox';
import { LiveBidPage } from './LiveBidPage';
import './listing.css';

type LoadState = 'loading' | 'ready' | 'error' | 'missing';

export function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const { client, user, favoriteIds, toggleFavorite } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [photo, setPhoto] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  // Desktop hover zoom: the cursor drives transform-origin so the point
  // under the pointer stays put while the photo scales.
  const [hoverZoom, setHoverZoom] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const faceRef = useRef<HTMLDivElement>(null);

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
      setPhoto(0);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    return client.subscribeToListing(id, (updated) => {
      setListing((prev) => (prev ? { ...prev, ...updated, seller: prev.seller, likes: prev.likes } : prev));
    });
  }, [client, id]);

  if (state === 'loading') {
    return (
      <main className="ldetail" aria-busy="true">
        <div className="skeleton" style={{ height: 420 }} />
      </main>
    );
  }

  if (state === 'missing') {
    return (
      <main className="ldetail">
        <div className="empty-dashed">
          <h3>Listing not found</h3>
          <p>It may have been removed by the seller.</p>
          <Link to="/browse" className="btn-acid">Back to browse</Link>
        </div>
      </main>
    );
  }

  if (state === 'error' || !listing) {
    return (
      <main className="ldetail">
        <div className="empty-dashed" role="alert">
          <h3>Couldn&apos;t load this listing</h3>
          <p>Something went wrong on our side.</p>
          <button className="btn-acid" onClick={() => void load()}>Retry</button>
        </div>
      </main>
    );
  }

  // An auction is an event with its own room — not a listing page.
  if (listing.saleType === 'auction') {
    return <LiveBidPage listing={listing} onReload={() => void load()} />;
  }

  const isOwner = user?.id === listing.sellerId;
  const watched = favoriteIds.has(listing.id);
  const cover = listing.images[photo] ?? listing.images[0];
  const sellerHandle = listing.seller.username
    ? `@${listing.seller.username}`
    : listing.seller.displayName;

  const specs: Array<[string, string]> = [
    ['Game', GAME_LABELS[listing.game]],
    ['Set', listing.setName || '—'],
    ['Card no.', listing.cardNumber || '—'],
    ['Finish', FINISH_LABELS[listing.finish]],
    ['Condition', `${listing.condition} — ${CONDITION_LABELS[listing.condition].toLowerCase()}`],
    ['Grade', listing.gradeValue ? `${listing.gradeValue}${listing.gradeCompany && !listing.gradeValue.toUpperCase().startsWith(listing.gradeCompany.toUpperCase()) ? ` (${listing.gradeCompany})` : ''}` : 'Raw / ungraded'],
    ['Language', listing.language],
    ['Quantity', String(listing.quantity)],
    ['Status', STATUS_LABELS[listing.status]],
  ];

  const messageSeller = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    setBusy(true);
    try {
      const conv = await client.openConversation(listing.id);
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open the conversation');
    } finally {
      setBusy(false);
    }
  };

  const watch = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    await toggleFavorite(listing.id);
    toast(watched ? 'Removed from watchlist' : 'Added to watchlist');
  };

  const changeStatus = async (status: ListingStatus) => {
    setBusy(true);
    try {
      await client.setListingStatus(listing.id, status);
      await load();
      toast(`Marked ${STATUS_LABELS[status].toLowerCase()}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="ldetail">
      <button type="button" className="btn-ghost-mono is-muted" onClick={() => navigate('/browse')}>
        ← Back to browse
      </button>

      <div className="ldetail-cols">
        <div className="ldetail-media">
          <div
            ref={faceRef}
            className={`ldetail-face ${cover ? 'is-zoomable' : ''}`}
            style={cover ? undefined : { background: faceBackground(listing.id) }}
            role={cover ? 'button' : undefined}
            tabIndex={cover ? 0 : undefined}
            aria-label={cover ? `Open ${listing.title} photo full screen` : undefined}
            onClick={() => cover && setLightbox(true)}
            onKeyDown={(e) => {
              if (cover && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setLightbox(true);
              }
            }}
            onMouseEnter={() => cover && setHoverZoom(true)}
            onMouseLeave={() => setHoverZoom(false)}
            onMouseMove={(e) => {
              if (!cover) return;
              const r = e.currentTarget.getBoundingClientRect();
              setZoomOrigin({
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
              });
            }}
          >
            {cover ? (
              <>
                <img
                  src={cover.url}
                  alt={`${listing.title} — photo ${photo + 1}`}
                  className={hoverZoom ? 'is-hover-zoom' : ''}
                  style={
                    hoverZoom
                      ? { transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }
                      : undefined
                  }
                />
                <span className="mono-label ldetail-zoom-hint" aria-hidden="true">
                  ⤢ Click to enlarge
                </span>
              </>
            ) : (
              <div className="ldetail-glyph" aria-hidden="true">{glyphOf(listing.title)}</div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="ldetail-thumbs">
              {listing.images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  aria-label={`View photo ${i + 1}`}
                  aria-pressed={i === photo}
                  className={`ldetail-thumb ${i === photo ? 'ldetail-thumb-on' : ''}`}
                  onClick={() => setPhoto(i)}
                >
                  <img src={img.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ldetail-info">
          <div className="mono-label">
            {GAME_LABELS[listing.game]}
            {listing.setName ? ` · ${listing.setName}` : ''}
          </div>
          <h1 className="display ldetail-title">{listing.title}</h1>
          <div className="ldetail-price-row">
            <span className="mono-label">Asking</span>
            <span className="display ldetail-price">
              {formatPrice(listing.price, listing.currency)}
            </span>
            {listing.status !== 'active' && (
              <span
                className={`mono-label ${listing.status === 'sold' ? 'ldetail-tag-muted' : 'ldetail-tag'}`}
              >
                {STATUS_LABELS[listing.status]}
              </span>
            )}
          </div>

          {isOwner ? (
            <div className="ldetail-actions">
              {(listing.status === 'active' || listing.status === 'reserved') && (
                <Link to={`/sell/${listing.id}`} className="btn-outline">Edit</Link>
              )}
              {allowedTransitions(listing.status).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={s === 'sold' ? 'btn-acid' : s === 'removed' ? 'btn-outline btn-danger-outline' : 'btn-outline'}
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
          ) : (
            <div className="ldetail-actions">
              <button
                type="button"
                className="btn-acid ldetail-msg"
                disabled={busy || listing.status === 'sold' || listing.status === 'removed'}
                onClick={() => void messageSeller()}
              >
                {listing.status === 'sold'
                  ? 'Sold'
                  : listing.status === 'removed'
                    ? 'Unavailable'
                    : 'Message seller'}
              </button>
              <button
                type="button"
                aria-label={watched ? 'Remove from watchlist' : 'Watch'}
                aria-pressed={watched}
                className="btn-icon ldetail-icon"
                onClick={() => void watch()}
              >
                {watched ? '★' : '☆'}
              </button>
              <button
                type="button"
                aria-label="Report listing"
                className="btn-icon ldetail-icon ldetail-report"
                onClick={() => setReportOpen(true)}
              >
                ⚑
              </button>
            </div>
          )}

          <table className="ldetail-specs">
            <tbody>
              {specs.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono-label ldetail-spec-k">{k}</td>
                  <td className="ldetail-spec-v">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {listing.description && <p className="ldetail-desc">{listing.description}</p>}

          <div className="ldetail-seller panel">
            <div className="ldetail-seller-top">
              {listing.seller.avatarUrl ? (
                <Avatar profile={listing.seller} size={44} />
              ) : (
                <div
                  className="ldetail-seller-avatar"
                  style={{ background: avatarBackground(sellerHandle) }}
                  aria-hidden="true"
                />
              )}
              <div>
                <Link
                  to={listing.seller.username ? `/u/${listing.seller.username}` : '#'}
                  className="ldetail-seller-name"
                >
                  {sellerHandle}
                </Link>
                <div className="ldetail-seller-meta">
                  member since {memberSince(listing.seller.createdAt)}
                </div>
              </div>
            </div>
            <div className="ldetail-seller-stats">
              <div>
                <div className="mono-label">Reviews</div>
                <div className="mono-value ldetail-seller-stat">
                  {listing.seller.ratingAvg !== null
                    ? `${listing.seller.ratingAvg.toFixed(1)} · ${listing.seller.ratingCount}`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="mono-label">Watching</div>
                <div className="mono-value ldetail-seller-stat">{listing.likes}</div>
              </div>
              <div>
                <div className="mono-label">Listings</div>
                <div className="mono-value ldetail-seller-stat">
                  {listing.sellerActiveListingCount}
                </div>
              </div>
            </div>
            <div className="ldetail-safety">
              LebanonTCG doesn&apos;t handle payment or shipping. You&apos;ll arrange both directly
              with the seller in chat. <Link to="/safety">How to trade safely</Link>
            </div>
          </div>
          <PregradeListingPanel listingId={listing.id} sellerId={listing.sellerId} />
        </div>
      </div>

      {lightbox && cover && (
        <ImageLightbox
          images={listing.images}
          index={photo}
          alt={listing.title}
          onIndexChange={setPhoto}
          onClose={() => setLightbox(false)}
        />
      )}

      {reportOpen && (
        <ReportDialog
          targetType="listing"
          targetId={listing.id}
          targetLabel={listing.title}
          onClose={() => setReportOpen(false)}
        />
      )}
    </main>
  );
}
