import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PendingReview, Review } from '../lib/types';
import { formatPrice, relativeTime } from '../lib/format';
import { faceBackground, glyphOf } from '../lib/face';
import { useApp } from '../state/AppContext';
import { Avatar } from '../components/Avatar';
import { ReviewPrompt } from '../components/ReviewPrompt';
import './reviews.css';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/**
 * Post-transaction review hub: trades waiting to be rated, reviews
 * received, reviews written. Reviews open once a deal is confirmed
 * (the listing is marked sold) and each party rates the other once.
 */
export function ReviewsPage() {
  const { client, user, refreshPendingReviews } = useApp();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [received, setReceived] = useState<Review[]>([]);
  const [written, setWritten] = useState<Review[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      client.getPendingReviews(),
      client.getReviewsForUser(user.id),
      client.getReviewsWritten().catch(() => [] as Review[]),
    ])
      .then(([p, r, w]) => {
        if (cancelled) return;
        setPending(p);
        setReceived(r);
        setWritten(w);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client, user]);

  useEffect(() => load(), [load]);

  if (!user) {
    return (
      <div className="reviews">
        <div className="empty-dashed">
          <h3>Reviews</h3>
          <p>Sign in to rate the people you&apos;ve traded with.</p>
          <Link to="/signin" className="btn-acid">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const onReviewed = () => {
    load();
    refreshPendingReviews();
  };

  return (
    <div className="reviews">
      <header className="reviews-head">
        <div className="mono-label reviews-eyebrow">Trust</div>
        <h1 className="display">Reviews</h1>
        <p className="reviews-sub">
          Every confirmed deal opens a review for both sides. Ratings show on your profile and
          rank you on the sellers board.
        </p>
        <div className="reviews-stats">
          <div className="reviews-stat">
            <div className="mono-label">Rating</div>
            <div className="mono-value reviews-stat-value">
              {user.ratingAvg !== null ? user.ratingAvg.toFixed(1) : '—'}
            </div>
          </div>
          <div className="reviews-stat">
            <div className="mono-label">Received</div>
            <div className="mono-value reviews-stat-value">{received.length}</div>
          </div>
          <div className="reviews-stat">
            <div className="mono-label">Awaiting you</div>
            <div className="mono-value reviews-stat-value">{pending.length}</div>
          </div>
        </div>
      </header>

      {state === 'error' && (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load your reviews</h3>
          <button className="btn-acid" onClick={() => load()}>
            Retry
          </button>
        </div>
      )}

      <section aria-label="Trades to rate" className="reviews-section">
        <div className="section-head">
          <h2>Rate your trades</h2>
          <div className="mono-label">{String(pending.length).padStart(2, '0')} waiting</div>
        </div>
        {pending.length === 0 ? (
          <p className="reviews-empty">
            {state === 'loading'
              ? 'Loading…'
              : 'Nothing to rate right now. When a deal is confirmed in chat, it lands here.'}
          </p>
        ) : (
          <div className="reviews-pending">
            {pending.map((p) => (
              <article key={p.conversationId} className="panel reviews-card">
                <div className="reviews-card-head">
                  <div
                    className="reviews-thumb"
                    style={p.listing.images[0] ? undefined : { background: faceBackground(p.listing.id) }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${p.listing.title}`}
                    onClick={() => navigate(`/listing/${p.listing.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/listing/${p.listing.id}`);
                    }}
                  >
                    {p.listing.images[0] ? (
                      <img src={p.listing.images[0].url} alt="" loading="lazy" />
                    ) : (
                      <span className="reviews-thumb-glyph" aria-hidden="true">
                        {glyphOf(p.listing.title)}
                      </span>
                    )}
                  </div>
                  <div className="reviews-card-id">
                    <div className="reviews-card-title display">{p.listing.title}</div>
                    <div className="mono-label reviews-card-meta">
                      {formatPrice(p.listing.price, p.listing.currency)} · deal closed
                    </div>
                    <button
                      type="button"
                      className="reviews-party"
                      onClick={() =>
                        p.otherParty.username && navigate(`/u/${p.otherParty.username}`)
                      }
                    >
                      <Avatar profile={p.otherParty} size={24} />
                      <span>@{p.otherParty.username ?? p.otherParty.displayName}</span>
                    </button>
                  </div>
                  <Link to={`/chat/${p.conversationId}`} className="btn-outline reviews-thread">
                    Open thread
                  </Link>
                </div>
                <ReviewPrompt
                  conversationId={p.conversationId}
                  otherParty={p.otherParty}
                  onDone={onReviewed}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Reviews received" className="reviews-section">
        <div className="section-head">
          <h2>Received</h2>
          <div className="mono-label">{String(received.length).padStart(2, '0')} total</div>
        </div>
        {received.length === 0 ? (
          <p className="reviews-empty">
            No reviews yet — they arrive after your first completed deal.
          </p>
        ) : (
          <div className="reviews-list">
            {received.map((r) => (
              <div key={r.id} className="panel reviews-row">
                <Avatar profile={r.reviewer} size={34} />
                <div className="reviews-row-body">
                  <div className="reviews-row-head">
                    <strong>{r.reviewer.displayName}</strong>
                    <span className="mono-value reviews-stars">{stars(r.rating)}</span>
                    <span className="mono-label reviews-time">{relativeTime(r.createdAt)}</span>
                  </div>
                  {r.body && <p className="reviews-body">{r.body}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {written.length > 0 && (
        <section aria-label="Reviews written" className="reviews-section">
          <div className="section-head">
            <h2>Written by you</h2>
            <div className="mono-label">{String(written.length).padStart(2, '0')} total</div>
          </div>
          <div className="reviews-list">
            {written.map((r) => (
              <div key={r.id} className="panel reviews-row">
                <div className="reviews-row-body">
                  <div className="reviews-row-head">
                    <span className="mono-value reviews-stars">{stars(r.rating)}</span>
                    <span className="mono-label reviews-time">{relativeTime(r.createdAt)}</span>
                  </div>
                  {r.body && <p className="reviews-body">{r.body}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
