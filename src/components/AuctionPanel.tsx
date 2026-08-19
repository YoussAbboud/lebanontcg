import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuctionDetail, Bid, ListingWithSeller } from '../lib/types';
import {
  BID_DISCLAIMER,
  formatTimeLeft,
  isEffectivelyOver,
  isEndingSoon,
  minNextBid,
} from '../lib/auction';
import { formatPrice, relativeTime } from '../lib/format';
import { useNow } from '../lib/useNow';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import './auctionpanel.css';

/**
 * The live auction panel on a listing page: current bid in large mono,
 * ticking countdown (acid + seconds inside five minutes), bid history
 * with anti-snipe rows, and the bid form. Bids are optimistic with a
 * loud rejected state — never a silent failure. All real validation is
 * server-side; the client only prefills the minimum.
 */
export function AuctionPanel({
  listing,
  onAuctionChanged,
  onDetail,
}: {
  listing: ListingWithSeller;
  onAuctionChanged(): void;
  /** Mirror of the loaded detail — the Live Bid page feeds its banner
      and price chart from it. */
  onDetail?(detail: AuctionDetail): void;
}) {
  const { client, user } = useApp();
  const toast = useToast();
  const [reportingNoShow, setReportingNoShow] = useState(false);
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [extendedFlash, setExtendedFlash] = useState(false);
  const now = useNow(1000);
  const endsAtRef = useRef<string | null>(null);
  const statusRef = useRef<string | null>(null);
  const inputTouched = useRef(false);

  const load = useCallback(async () => {
    const d = await client.getAuctionForListing(listing.id).catch(() => null);
    if (d) {
      setDetail(d);
      onDetail?.(d);
    }
    return d;
  }, [client, listing.id, onDetail]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: new bids and auction-row changes (extensions, close).
  useEffect(() => {
    const auctionId = detail?.auction.id ?? listing.auction?.id;
    if (!auctionId) return;
    return client.subscribeToAuction(auctionId, () => {
      void load();
    });
  }, [client, detail?.auction.id, listing.auction?.id, load]);

  // Anti-snipe extension animates the timer; a close refreshes the page
  // state (status tag, seller controls) via the parent.
  useEffect(() => {
    if (!detail) return;
    if (endsAtRef.current && detail.auction.endsAt > endsAtRef.current) {
      setExtendedFlash(true);
      window.setTimeout(() => setExtendedFlash(false), 1600);
    }
    endsAtRef.current = detail.auction.endsAt;
    if (statusRef.current && statusRef.current !== detail.auction.status) {
      onAuctionChanged();
    }
    statusRef.current = detail.auction.status;
  }, [detail, onAuctionChanged]);

  if (!detail) return null;
  const { auction, bids } = detail;
  const over = isEffectivelyOver(auction, now);
  const top = bids.reduce<Bid | null>((b, x) => (b === null || x.amount > b.amount ? x : b), null);
  const minNext = minNextBid(top ? top.amount : null, auction.startingPrice);
  const myTopBid = user
    ? bids.filter((b) => b.bidderId === user.id).reduce<Bid | null>(
        (b, x) => (b === null || x.amount > b.amount ? x : b),
        null,
      )
    : null;
  const isSeller = user?.id === auction.sellerId;
  const soon = isEndingSoon(auction.endsAt, now);
  const belowReserve =
    auction.reservePrice !== null && (top === null || top.amount < auction.reservePrice);

  const shown = input === '' || !inputTouched.current ? String(minNext) : input;

  // Accountability: after a close with a winner, the seller can mark the
  // winner a no-show; the winner mirrors it for an unresponsive seller.
  const closedWithWinner = auction.status === 'closed' && auction.winnerId !== null;
  const canReportNoShow =
    closedWithWinner &&
    user !== null &&
    (user.id === auction.sellerId || user.id === auction.winnerId) &&
    !detail.myNoShowReported;

  const reportNoShow = async () => {
    if (reportingNoShow) return;
    setReportingNoShow(true);
    try {
      await client.reportAuctionNoShow(auction.id);
      toast('Recorded. Three winner no-shows in 90 days block bidding.');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not record the no-show.');
    } finally {
      setReportingNoShow(false);
    }
  };

  const place = async () => {
    if (!user || busy) return;
    const amount = Number(shown);
    setBusy(true);
    setRejected(null);
    try {
      await client.placeBid(auction.id, amount);
      inputTouched.current = false;
      setInput('');
      await load();
    } catch (err) {
      // Never silent: refetch, then say exactly what the new floor is.
      const fresh = await load();
      const freshTop = fresh?.bids.reduce<Bid | null>(
        (b, x) => (b === null || x.amount > b.amount ? x : b),
        null,
      );
      const freshMin = fresh
        ? minNextBid(freshTop ? freshTop.amount : null, fresh.auction.startingPrice)
        : minNext;
      const msg = err instanceof Error ? err.message : 'Bid rejected.';
      setRejected(
        /minimum/i.test(msg)
          ? `Someone bid first. New minimum is ${formatPrice(freshMin, auction.currency)}.`
          : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="aucpanel panel" aria-label="Live auction">
      <div className="aucpanel-head">
        <div>
          <div className="mono-label">{top ? 'Current bid' : 'Starting at'}</div>
          <div className="mono-value aucpanel-price display">
            {formatPrice(top ? top.amount : auction.startingPrice, auction.currency)}
          </div>
          <div className="mono-label aucpanel-count">
            {bids.length} bid{bids.length === 1 ? '' : 's'}
            {auction.reservePrice !== null && !over && (
              <span className="aucpanel-reserve"> · {belowReserve ? 'reserve not met' : 'reserve met'}</span>
            )}
          </div>
        </div>
        <div className="aucpanel-clock">
          <div className="mono-label">{over ? 'Ended' : 'Ends in'}</div>
          <div
            className={`mono-value aucpanel-countdown display ${soon && !over ? 'is-acid-text' : ''} ${extendedFlash ? 'is-extended' : ''}`}
            aria-live="polite"
          >
            {over ? '—' : formatTimeLeft(auction.endsAt, now)}
          </div>
        </div>
      </div>

      {over ? (
        <p className="aucpanel-outcome">
          {auction.status === 'cancelled'
            ? `The seller cancelled this auction${auction.cancelReason ? ` — ${auction.cancelReason}` : '.'}`
            : auction.winnerId
              ? `Won at ${formatPrice(auction.winningBid ?? 0, auction.currency)} — the deal moves to chat between the winner and the seller.`
              : top
                ? 'Reserve not met — nobody wins, the card stays with the seller.'
                : 'Ended without a bid.'}
        </p>
      ) : isSeller ? (
        <p className="aucpanel-sellernote mono-label">
          Your auction — bids land here live. End early or cancel above.
        </p>
      ) : (
        <div className="aucpanel-bidrow">
          <input
            className="input input-mono aucpanel-input"
            type="number"
            inputMode="decimal"
            min={minNext}
            step="0.01"
            aria-label="Your bid"
            value={shown}
            onChange={(e) => {
              inputTouched.current = true;
              setInput(e.target.value);
            }}
          />
          <button
            type="button"
            className="btn-acid"
            disabled={busy || !user}
            onClick={() => void place()}
          >
            {busy ? 'Bidding…' : 'Place bid'}
          </button>
        </div>
      )}
      {!over && !isSeller && !user && (
        <p className="mono-label aucpanel-signin">Sign in to bid.</p>
      )}
      {rejected && (
        <p className="field-error aucpanel-rejected" role="alert">
          {rejected}
        </p>
      )}
      {!over && <p className="mono-label aucpanel-disclaimer">{BID_DISCLAIMER}</p>}
      {canReportNoShow && (
        <button
          type="button"
          className="btn-ghost-mono aucpanel-noshow"
          disabled={reportingNoShow}
          onClick={() => void reportNoShow()}
        >
          {user?.id === auction.sellerId
            ? "Winner didn't follow through"
            : "Seller didn't follow through"}
        </button>
      )}
      {closedWithWinner && detail.myNoShowReported && (
        <p className="mono-label aucpanel-noshow-done">No-show recorded — it feeds the report queue.</p>
      )}

      {bids.length > 0 && (
        <ol className="aucpanel-history" aria-label="Bid history">
          {bids.map((b) => (
            <li key={b.id} className="aucpanel-row">
              {b.extended && (
                <div className="mono-label aucpanel-extend">+60s — bid in the final minute.</div>
              )}
              <div className="aucpanel-bid">
                <span className="aucpanel-bidder">{b.bidderName}</span>
                <span className="mono-value">{formatPrice(b.amount, auction.currency)}</span>
                <span className="mono-label aucpanel-when">{relativeTime(b.createdAt)}</span>
                {myTopBid && b.id === myTopBid.id && top && top.bidderId !== user?.id && (
                  <span className="mono-label aucpanel-outbid">Outbid</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
