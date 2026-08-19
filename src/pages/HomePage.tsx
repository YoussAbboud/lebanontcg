import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ListingWithSeller, SellerStats } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { DEFAULT_FILTER } from '../lib/filter';
import { formatPrice } from '../lib/format';
import { avatarBackground, faceBackground, glyphOf } from '../lib/face';
import { useApp } from '../state/AppContext';
import { FanCarousel } from '../components/FanCarousel';
import { ListingCard } from '../components/ListingCard';
import { listingEyebrow } from '../components/ListingCard';
import { Avatar } from '../components/Avatar';
import { useDragScroll } from '../lib/useDragScroll';
import './home.css';

export function HomePage() {
  const { client, pendingReviewCount } = useApp();
  const navigate = useNavigate();
  const [total, setTotal] = useState<number | null>(null);
  const [fanItems, setFanItems] = useState<ListingWithSeller[]>([]);
  const [fanMode, setFanMode] = useState<'fresh' | 'ending'>('fresh');
  const [endingItems, setEndingItems] = useState<ListingWithSeller[] | null>(null);
  const [featured, setFeatured] = useState<ListingWithSeller[]>([]);
  const [trending, setTrending] = useState<ListingWithSeller[]>([]);
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const stripRef = useRef<HTMLDivElement>(null);
  // Mouse drag scrolls the featured strip (touch already scrolls natively).
  // The strip mounts only after data lands, hence the enabled flag.
  useDragScroll(stripRef, state === 'ready' && featured.length > 0);

  useEffect(() => {
    let cancelled = false;
    // Only the main listings query is fatal; featured/sellers degrade to
    // empty sections so one broken view can't blank the whole home page.
    Promise.all([
      client.searchListings(DEFAULT_FILTER, 0, 15),
      client.searchListings({ ...DEFAULT_FILTER, sort: 'most_watched' }, 0, 6).catch(() => null),
      client.listSellers(6).catch(() => []),
    ])
      .then(([newest, watched, topSellers]) => {
        if (cancelled) return;
        setTotal(newest.total);
        setFanItems(newest.items.slice(0, 7));
        // The fan showcases the 7 newest; the grid takes what's left. On a
        // young marketplace there is nothing left, so it shows the same
        // cards rather than an empty "nothing listed yet" panel.
        setTrending(
          newest.items.length > 7 ? newest.items.slice(7, 15) : newest.items,
        );
        setFeatured(watched ? watched.items : []);
        setSellers(topSellers);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Permanent acid pins: the newest listing in the featured strip and the
  // most-liked card in the trending grid (nothing pinned on a likes tie at 0).
  const newestFeaturedId = featured.reduce(
    (best, f) => (best === null || f.createdAt > best.createdAt ? f : best),
    null as ListingWithSeller | null,
  )?.id;
  const mostLiked = trending.reduce(
    (best, l) => (best === null || l.likes > best.likes ? l : best),
    null as ListingWithSeller | null,
  );
  const mostLikedId = mostLiked && mostLiked.likes > 0 ? mostLiked.id : undefined;

  // "Ending soon": the fan flips to live auctions ordered by the clock.
  const showEnding = async () => {
    setFanMode('ending');
    if (endingItems) return;
    try {
      const page = await client.searchListings(
        { ...DEFAULT_FILTER, saleType: 'auction', sort: 'ending_soon' },
        0,
        7,
      );
      setEndingItems(page.items);
    } catch {
      setEndingItems([]);
    }
  };

  const scrollStrip = (dir: number) => {
    stripRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  if (state === 'error') {
    const schemaMissing = /does not exist|schema cache|could not find/i.test(errorMsg);
    return (
      <div className="home-error empty-dashed">
        <h3>Couldn&apos;t load the marketplace</h3>
        {errorMsg && (
          <p className="mono-label home-error-detail" role="alert">
            {errorMsg}
          </p>
        )}
        <p>
          {schemaMissing
            ? 'The database tables are missing — the schema hasn’t been applied to this Supabase project yet. Run supabase/apply-all.sql in the SQL Editor, then retry.'
            : 'Something went wrong on our side. Give it another try.'}
        </p>
        <button className="btn-acid" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="home">
      {pendingReviewCount > 0 && (
        <Link to="/reviews" className="home-review-banner panel">
          <span className="mono-label home-review-eyebrow">Deal closed</span>
          <span className="home-review-text">
            You have {pendingReviewCount} trade{pendingReviewCount === 1 ? '' : 's'} to rate —
            your review builds the other collector&apos;s reputation.
          </span>
          <span className="btn-acid home-review-cta">Rate now</span>
        </Link>
      )}

      <section className="home-hero">
        <div className="mono-label home-eyebrow">
          Peer-to-peer{total !== null ? ` · ${total.toLocaleString()} cards listed` : ''}
        </div>
        <h1 className="home-headline">
          We connect
          <br />
          <span className="hero-grad-text">Collectors</span>
        </h1>
        <p className="home-sub">
          List what you own, message the person who has what you want. No checkout, no fees, you
          agree the terms yourselves.
        </p>
      </section>

      {state === 'loading' ? (
        <div className="home-fan-skeleton">
          <div className="skeleton" />
        </div>
      ) : (
        <>
          <div className="home-fanmode" role="radiogroup" aria-label="Carousel mode">
            <button
              type="button"
              className="pill"
              aria-pressed={fanMode === 'fresh'}
              onClick={() => setFanMode('fresh')}
            >
              Fresh drops
            </button>
            <button
              type="button"
              className="pill"
              aria-pressed={fanMode === 'ending'}
              onClick={() => void showEnding()}
            >
              Ending soon
            </button>
          </div>
          <FanCarousel
            items={fanMode === 'ending' ? (endingItems ?? []) : fanItems}
          />
          {fanMode === 'ending' && endingItems !== null && endingItems.length === 0 && (
            <p className="mono-label home-fanmode-empty">No live auctions right now.</p>
          )}
        </>
      )}

      {featured.length > 0 && (
        <section aria-label="Featured this week" className="home-featured">
          <div className="section-head">
            <h2>Featured this week</h2>
            <div className="home-featured-arrows">
              <button
                type="button"
                aria-label="Scroll left"
                className="btn-icon home-arrow"
                onClick={() => scrollStrip(-1)}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                className="btn-icon home-arrow"
                onClick={() => scrollStrip(1)}
              >
                →
              </button>
            </div>
          </div>
          <div className="scrollx home-strip" ref={stripRef}>
            {featured.map((f) => {
              return (
                <div
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  className={`home-strip-card ${f.id === newestFeaturedId ? 'is-acid-strip' : ''}`}
                  onClick={() => navigate(`/listing/${f.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/listing/${f.id}`);
                  }}
                >
                  <div
                    className="home-strip-face"
                    style={f.images[0] ? undefined : { background: faceBackground(f.id) }}
                  >
                    {f.images[0] ? (
                      <img src={f.images[0].url} alt="" loading="lazy" />
                    ) : (
                      <div className="home-strip-glyph" aria-hidden="true">
                        {glyphOf(f.title)}
                      </div>
                    )}
                  </div>
                  <div className="home-strip-body">
                    <div className="mono-label home-strip-eyebrow">{listingEyebrow(f)}</div>
                    <div className="home-strip-title display">{f.title}</div>
                    <div className="home-strip-asking">
                      <span className="mono-label home-strip-eyebrow">Asking</span>
                      <span className="mono-value">{formatPrice(f.price, f.currency)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section aria-label="Trending sellers and listings" className="home-trending dotgrid">
        <div className="section-head">
          <h2>Trending sellers &amp; cards</h2>
          <div className="mono-label home-trending-note">Last 30 days</div>
        </div>

        <div className="home-trending-cols">
          <div className="panel home-sellers">
            <div className="mono-label home-sellers-title">Top sellers</div>
            <div className="home-sellers-rows">
              {sellers.map((s) => (
                <div
                  key={s.profile.id}
                  role="button"
                  tabIndex={0}
                  className="home-seller-row"
                  onClick={() => s.profile.username && navigate(`/u/${s.profile.username}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && s.profile.username) navigate(`/u/${s.profile.username}`);
                  }}
                >
                  <div className="mono-label home-seller-rank">
                    {String(s.rank).padStart(2, '0')}
                  </div>
                  {s.profile.avatarUrl ? (
                    <Avatar profile={s.profile} size={30} />
                  ) : (
                    <div
                      className={`home-seller-avatar ${s.rank === 1 ? 'home-seller-avatar-top' : ''}`}
                      style={
                        s.rank === 1
                          ? undefined
                          : { background: avatarBackground(s.profile.username ?? s.profile.id) }
                      }
                      aria-hidden="true"
                    />
                  )}
                  <div className="home-seller-names">
                    <div className="home-seller-handle">
                      @{s.profile.username ?? s.profile.displayName}
                    </div>
                    <div className="home-seller-rating">
                      {s.profile.ratingAvg !== null
                        ? `${s.profile.ratingAvg.toFixed(1)} · ${s.profile.ratingCount} review${s.profile.ratingCount === 1 ? '' : 's'}`
                        : 'No reviews yet'}
                    </div>
                  </div>
                  <div className="home-seller-count mono-value">{s.activeCount}</div>
                </div>
              ))}
              {sellers.length === 0 && (
                <p className="home-sellers-empty">No sellers yet — be the first to list.</p>
              )}
            </div>
            <Link to="/sellers" className="btn-ghost-mono home-sellers-more">
              See more →
            </Link>
          </div>

          <div className="home-trending-grid">
            {trending.map((l) => (
              <ListingCard key={l.id} listing={l} pinned={l.id === mostLikedId} />
            ))}
            {state === 'ready' && trending.length === 0 && (
              <div className="empty-dashed home-trending-empty">
                <h3>Nothing else listed yet</h3>
                <p>The newest cards land here as collectors post them.</p>
                <Link to="/sell" className="btn-acid">
                  List a card
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="home-games mono-label" aria-hidden="true">
        {Object.values(GAME_LABELS).join('  ·  ')}
      </div>
    </div>
  );
}
