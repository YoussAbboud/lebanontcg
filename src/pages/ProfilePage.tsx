import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Listing, Profile, Review } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { formatPrice, memberSince, relativeTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { Avatar } from '../components/Avatar';
import { RatingStars } from '../components/RatingStars';
import { ReportDialog } from '../components/ReportDialog';
import './profile.css';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { client, user } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isOwn = Boolean(user && profile && user.id === profile.id);

  const load = useCallback(async () => {
    if (!username) return;
    setState('loading');
    try {
      const p = await client.getProfileByUsername(username);
      if (!p) {
        setState('missing');
        return;
      }
      const own = user?.id === p.id;
      const [ls, rs, blockedIds] = await Promise.all([
        client.getListingsBySeller(p.id, own ? ['active', 'reserved', 'sold', 'removed'] : ['active']),
        client.getReviewsForUser(p.id),
        user ? client.getBlockedIds() : Promise.resolve(new Set<string>()),
      ]);
      setProfile(p);
      setListings(ls);
      setReviews(rs);
      setBlocked(blockedIds.has(p.id));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, username, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') {
    return (
      <div className="profile" aria-busy="true">
        <div className="skeleton" style={{ height: 140 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Collector not found</h3>
        <p>No profile with that username.</p>
        <Link to="/" className="btn btn-primary">Back to browse</Link>
      </div>
    );
  }

  if (state === 'error' || !profile) {
    return (
      <div className="empty-state" role="alert">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Couldn&apos;t load this profile</h3>
        <button className="btn btn-primary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  const toggleBlock = async () => {
    setBlockBusy(true);
    try {
      await client.setBlocked(profile.id, !blocked);
      setBlocked(!blocked);
    } finally {
      setBlockBusy(false);
    }
  };

  const activeListings = listings.filter((l) => l.status === 'active');

  return (
    <div className="profile">
      <header className="profile-head panel">
        <Avatar profile={profile} size={84} />
        <div className="profile-id">
          <h1 className="display">{profile.displayName}</h1>
          <p className="profile-handle">@{profile.username}</p>
          <div className="profile-meta">
            <RatingStars avg={profile.ratingAvg} count={profile.ratingCount} />
            <span>Member since {memberSince(profile.createdAt)}</span>
            <span>
              {activeListings.length} active listing{activeListings.length === 1 ? '' : 's'}
            </span>
          </div>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        </div>
        <div className="profile-actions">
          {isOwn ? (
            <>
              <Link to="/my-listings" className="btn btn-ghost btn-sm">My listings</Link>
              <Link to="/favorites" className="btn btn-ghost btn-sm">Favorites</Link>
              <Link to="/settings" className="btn btn-quiet btn-sm">Settings</Link>
            </>
          ) : (
            user && (
              <>
                <button
                  className={`btn btn-sm ${blocked ? 'btn-quiet' : 'btn-danger'}`}
                  disabled={blockBusy}
                  onClick={() => void toggleBlock()}
                >
                  {blocked ? 'Unblock' : 'Block'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}>
                  Report user
                </button>
              </>
            )
          )}
        </div>
      </header>

      {blocked && (
        <p className="profile-blocked-note" role="status">
          You blocked this user — they can&apos;t message you or open conversations on your
          listings, and you can&apos;t message them.
        </p>
      )}

      <section aria-label="Listings">
        <h2 className="microlabel profile-section-title">
          {isOwn ? 'Your listings' : 'Active listings'}
        </h2>
        {listings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-glyph" aria-hidden="true" />
            <h3 className="display">No listings</h3>
            <p>{isOwn ? 'List a card to get started.' : 'Nothing for sale right now.'}</p>
            {isOwn && <Link to="/sell" className="btn btn-primary">Sell a card</Link>}
          </div>
        ) : (
          <ul className="profile-listings">
            {listings.map((l) => (
              <li key={l.id}>
                <Link to={`/listing/${l.id}`} className="profile-listing card-surface">
                  {l.images[0] && <img src={l.images[0].url} alt="" loading="lazy" />}
                  <span className="profile-listing-info">
                    <span className="profile-listing-title">{l.title}</span>
                    <span className="profile-listing-meta">
                      {GAME_LABELS[l.game]}
                      {isOwn && l.status !== 'active' && (
                        <span className={`badge badge-${l.status}`}>{l.status}</span>
                      )}
                    </span>
                    <span className="price">{formatPrice(l.price, l.currency)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Reviews">
        <h2 className="microlabel profile-section-title">
          Reviews ({profile.ratingCount})
        </h2>
        {reviews.length === 0 ? (
          <p className="profile-noreviews">No reviews yet — reviews unlock after a completed sale.</p>
        ) : (
          <ul className="profile-reviews">
            {reviews.map((r) => (
              <li key={r.id} className="profile-review card-surface">
                <div className="profile-review-head">
                  <Avatar profile={r.reviewer} size={28} />
                  <strong>{r.reviewer.displayName}</strong>
                  <RatingStars avg={r.rating} count={1} showCount={false} />
                  <time className="profile-review-time">{relativeTime(r.createdAt)}</time>
                </div>
                {r.body && <p className="profile-review-body">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {reportOpen && (
        <ReportDialog
          targetType="user"
          targetId={profile.id}
          targetLabel={`@${profile.username}`}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
