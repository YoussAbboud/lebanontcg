import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { DEFAULT_FILTER } from '../lib/filter';
import { formatPrice } from '../lib/format';
import { formatTimeLeft, isEffectivelyOver } from '../lib/auction';
import { useNow } from '../lib/useNow';
import { useApp } from '../state/AppContext';
import './livebids.css';

interface FloatBid {
  key: number;
  name: string;
  amount: string;
}

/**
 * One live auction card on the home page: realtime current bid, a
 * watcher bubble (people with the Live Bid page open right now — this
 * card only observes, it never inflates the count), and each new bid
 * fading up over the card as "@name  $amount".
 */
function LiveBidCard({ listing }: { listing: ListingWithSeller }) {
  const { client } = useApp();
  const navigate = useNavigate();
  const now = useNow(1000);
  const [auction, setAuction] = useState(listing.auction ?? null);
  const [price, setPrice] = useState(listing.price);
  const [watchers, setWatchers] = useState(0);
  const [floats, setFloats] = useState<FloatBid[]>([]);
  const floatKey = useRef(0);

  const auctionId = listing.auction?.id;
  useEffect(() => {
    if (!auctionId) return;
    const offBids = client.subscribeToAuction(auctionId, (ev) => {
      setAuction(ev.auction);
      if (ev.type === 'bid' && ev.bid) {
        setPrice(ev.bid.amount);
        const f: FloatBid = {
          key: ++floatKey.current,
          name: ev.bid.bidderName,
          amount: formatPrice(ev.bid.amount, ev.auction.currency),
        };
        setFloats((prev) => [...prev.slice(-2), f]);
        window.setTimeout(
          () => setFloats((prev) => prev.filter((x) => x.key !== f.key)),
          2600,
        );
      }
    });
    const offPresence = client.subscribeToAuctionPresence(auctionId, setWatchers);
    return () => {
      offBids();
      offPresence();
    };
  }, [client, auctionId]);

  if (!auction || isEffectivelyOver(auction, now)) return null;
  const cover = listing.images[0];

  return (
    <button
      type="button"
      className="livebids-card card-raised"
      onClick={() => navigate(`/listing/${listing.id}`)}
      aria-label={`${listing.title}, current bid ${formatPrice(price, auction.currency)}, ${watchers} watching`}
    >
      <div className="livebids-facewrap">
        {cover ? (
          <img src={cover.url} alt="" className="livebids-face" />
        ) : (
          <div className="livebids-face livebids-face-empty" />
        )}
        <span className="mono-label livebids-eye" title="Collectors with this Live Bid open">
          ● {watchers}
        </span>
        <span className="mono-label livebids-clock">{formatTimeLeft(auction.endsAt, now)}</span>
        <div className="livebids-floats" aria-hidden="true">
          {floats.map((f) => (
            <span key={f.key} className="livebids-float mono-value">
              {f.name} {f.amount}
            </span>
          ))}
        </div>
      </div>
      <div className="livebids-body">
        <div className="livebids-title">{listing.title}</div>
        <div className="livebids-pricerow">
          <span className="mono-label">Current bid</span>
          <span className="mono-value livebids-price">{formatPrice(price, auction.currency)}</span>
        </div>
      </div>
    </button>
  );
}

/** The home page's Live Bids rail: live auctions, soonest close first. */
export function LiveBids() {
  const { client } = useApp();
  const [items, setItems] = useState<ListingWithSeller[]>([]);

  useEffect(() => {
    let cancelled = false;
    client
      .searchListings({ ...DEFAULT_FILTER, saleType: 'auction', sort: 'ending_soon' }, 0, 3)
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => {
        // No section beats a broken one.
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (items.length === 0) return null;
  return (
    <section className="livebids" aria-label="Live bids">
      <div className="livebids-head">
        <h2 className="display livebids-heading">
          <span className="livebids-dot" aria-hidden="true" /> Live Bids
        </h2>
        <Link to="/browse?type=auction&sort=ending_soon" className="mono-label livebids-all">
          All auctions →
        </Link>
      </div>
      <div className="livebids-grid">
        {items.map((l) => (
          <LiveBidCard key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
}
