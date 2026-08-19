import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AuctionDetail, ListingWithSeller } from '../lib/types';
import { CONDITION_LABELS, FINISH_LABELS, GAME_LABELS } from '../lib/types';
import { formatTimeLeft, isEffectivelyOver, isEndingSoon } from '../lib/auction';
import { memberSince } from '../lib/format';
import { glyphOf } from '../lib/face';
import { useNow } from '../lib/useNow';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { Avatar } from '../components/Avatar';
import { AuctionPanel } from '../components/AuctionPanel';
import { AuctionPriceChart } from '../components/AuctionPriceChart';
import { ImageLightbox } from '../components/ImageLightbox';
import { ReportDialog } from '../components/ReportDialog';
import { PregradeListingPanel } from '../components/pregrade/PregradeListingPanel';
import './livebid.css';

/**
 * The Live Bid page — an auction is an event, not a listing, and its
 * page says so: a pulsing LIVE banner with the watcher count and the
 * clock, the photo beside the bid arena, and the price chart + live
 * feed front and centre. Fixed-price listings keep the normal page;
 * /listing/:id branches here on sale type.
 */
export function LiveBidPage({
  listing,
  onReload,
}: {
  listing: ListingWithSeller;
  onReload(): void;
}) {
  const { client, user, favoriteIds, toggleFavorite } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow(1000);
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [watchers, setWatchers] = useState(0);
  const [photo, setPhoto] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const auction = detail?.auction ?? listing.auction ?? null;
  const auctionId = auction?.id;

  // This page IS the Live Bid room — being here counts as watching.
  useEffect(() => {
    if (!auctionId) return;
    return client.subscribeToAuctionPresence(auctionId, setWatchers, { join: true });
  }, [client, auctionId]);

  // Never a blank page: if the auction row can't be reached, say so.
  if (!auction) {
    return (
      <main className="livebid">
        <div className="empty-dashed" role="alert">
          <h3>Couldn&apos;t load this auction</h3>
          <p>The listing exists but its auction data didn&apos;t come through. Try again.</p>
          <button className="btn-acid" onClick={onReload}>Retry</button>
        </div>
      </main>
    );
  }
  const over = isEffectivelyOver(auction, now);
  const soon = isEndingSoon(auction.endsAt, now);
  const isOwner = user?.id === listing.sellerId;
  const watched = favoriteIds.has(listing.id);
  const cover = listing.images[photo] ?? listing.images[0];
  const sellerHandle = listing.seller.username
    ? `@${listing.seller.username}`
    : listing.seller.displayName;

  const askQuestion = async () => {
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

  const endNow = async () => {
    if (!window.confirm('End the auction now? The highest bid wins as-is.')) return;
    setBusy(true);
    try {
      await client.endAuctionEarly(auction.id);
      toast('Auction ended');
      onReload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not end the auction.');
    } finally {
      setBusy(false);
    }
  };

  const cancelNow = async () => {
    setBusy(true);
    try {
      await client.cancelAuction(auction.id, cancelReason.trim());
      toast('Auction cancelled — every bidder was notified.');
      setCancelOpen(false);
      onReload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not cancel the auction.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="livebid">
      <div
        className={`livebid-banner panel ${!over ? 'is-live' : ''} ${soon && !over ? 'is-soon' : ''}`}
      >
        <span className="livebid-dot" aria-hidden="true" />
        <span className="mono-label livebid-state">
          {!over
            ? 'Live auction'
            : auction.status === 'cancelled'
              ? 'Auction cancelled'
              : 'Auction ended'}
        </span>
        <span className="mono-label livebid-watchers" title="Collectors with this Live Bid open right now">
          ● {watchers} watching
        </span>
        <span className="mono-value livebid-clock">
          {over ? '—' : `ends in ${formatTimeLeft(auction.endsAt, now)}`}
        </span>
      </div>

      <div className="livebid-arena">
        <div className="livebid-photo">
          <div className="livebid-face" onClick={() => cover && setLightbox(true)}>
            {cover ? (
              <img src={cover.url} alt={listing.title} />
            ) : (
              <div className="livebid-glyph" aria-hidden="true">{glyphOf(listing.title)}</div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="livebid-thumbs">
              {listing.images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  aria-label={`View photo ${i + 1}`}
                  aria-pressed={i === photo}
                  className={`livebid-thumb ${i === photo ? 'is-on' : ''}`}
                  onClick={() => setPhoto(i)}
                >
                  <img src={img.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="livebid-rail">
          <div className="mono-label">
            {GAME_LABELS[listing.game]}
            {listing.setName ? ` · ${listing.setName}` : ''}
          </div>
          <h1 className="display livebid-title">{listing.title}</h1>

          <AuctionPanel listing={listing} onAuctionChanged={onReload} onDetail={setDetail} />

          <div className="livebid-actions ldetail-actions">
            {isOwner ? (
              !over ? (
                <>
                  <Link to={`/sell/${listing.id}`} className="btn-outline">Edit</Link>
                  <button type="button" className="btn-outline" disabled={busy} onClick={() => void endNow()}>
                    End auction now
                  </button>
                  <button
                    type="button"
                    className="btn-outline btn-danger-outline"
                    disabled={busy}
                    onClick={() => setCancelOpen((v) => !v)}
                  >
                    Cancel auction
                  </button>
                </>
              ) : (
                <>
                  <span className="mono-label livebid-ownernote">
                    {auction.status === 'cancelled'
                      ? 'You cancelled this auction.'
                      : auction.winnerId
                        ? 'Closed — the winner is in your messages.'
                        : auction.reservePrice !== null
                          ? 'Reserve not met — the card stays yours.'
                          : 'Ended without a winner.'}
                  </span>
                  {!auction.winnerId && (
                    <Link to={`/sell?relist=${listing.id}`} className="btn-acid">Relist</Link>
                  )}
                </>
              )
            ) : (
              <>
                <button type="button" className="btn-outline" disabled={busy} onClick={() => void askQuestion()}>
                  Ask a question
                </button>
                <button
                  type="button"
                  aria-label={watched ? 'Remove from watchlist' : 'Watch'}
                  aria-pressed={watched}
                  className="btn-icon"
                  onClick={() => {
                    if (!user) {
                      navigate('/signin');
                      return;
                    }
                    void toggleFavorite(listing.id);
                  }}
                >
                  {watched ? '★' : '☆'}
                </button>
                <button
                  type="button"
                  aria-label="Report listing"
                  className="btn-icon"
                  onClick={() => setReportOpen(true)}
                >
                  ⚑
                </button>
              </>
            )}
          </div>
          {cancelOpen && isOwner && !over && (
            <div className="livebid-cancelform ldetail-cancelform">
              <input
                className="input"
                placeholder="Why? Every bidder is told."
                value={cancelReason}
                maxLength={200}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <button
                type="button"
                className="btn-outline btn-danger-outline"
                disabled={busy || cancelReason.trim().length < 3}
                onClick={() => void cancelNow()}
              >
                Confirm cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {detail && detail.bids.length > 0 && (
        <section className="livebid-chartpanel panel" aria-label="Price history">
          <AuctionPriceChart auction={detail.auction} bids={detail.bids} now={now} />
        </section>
      )}

      <div className="livebid-below">
        <table className="ldetail-specs livebid-specs">
          <tbody>
            {(
              [
                ['Game', GAME_LABELS[listing.game]],
                ['Set', listing.setName || '—'],
                ['Card no.', listing.cardNumber || '—'],
                ['Finish', FINISH_LABELS[listing.finish]],
                ['Condition', `${listing.condition} — ${CONDITION_LABELS[listing.condition].toLowerCase()}`],
                ['Language', listing.language],
              ] as Array<[string, string]>
            ).map(([k, v]) => (
              <tr key={k}>
                <th className="mono-label">{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Link
          to={listing.seller.username ? `/u/${listing.seller.username}` : '#'}
          className="livebid-seller panel"
        >
          <Avatar profile={listing.seller} size={40} />
          <div>
            <div className="livebid-seller-name">{sellerHandle}</div>
            <div className="mono-label">
              member since {memberSince(listing.seller.createdAt)}
              {listing.seller.ratingAvg !== null &&
                ` · ★ ${listing.seller.ratingAvg.toFixed(1)} (${listing.seller.ratingCount})`}
            </div>
          </div>
        </Link>
      </div>

      {listing.description && <p className="livebid-desc">{listing.description}</p>}

      <PregradeListingPanel listingId={listing.id} sellerId={listing.sellerId} />

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
