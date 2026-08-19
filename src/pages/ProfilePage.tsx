import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Listing, ListingWithSeller, Profile, Review, SellerStats } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { avatarBackground } from '../lib/face';
import { memberSince, relativeTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { Avatar } from '../components/Avatar';
import { ListingCard } from '../components/ListingCard';
import { ReportDialog } from '../components/ReportDialog';
import './profile.css';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { client, user } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [blocked, setBlocked] = useState(false);
  const [noShows, setNoShows] = useState(0);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);

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
      const [ls, rs, blockedIds, sellerStats] = await Promise.all([
        client.getListingsBySeller(p.id, own ? ['active', 'reserved', 'sold', 'removed'] : ['active']),
        client.getReviewsForUser(p.id),
        user ? client.getBlockedIds() : Promise.resolve(new Set<string>()),
        client.getSellerStats(p.id),
      ]);
      setProfile(p);
      void client.getAuctionNoShowCount(p.id).then(setNoShows).catch(() => setNoShows(0));
      setListings(ls);
      setReviews(rs);
      setBlocked(blockedIds.has(p.id));
      setStats(sellerStats);
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
      <main className="profile" aria-busy="true">
        <div className="skeleton" style={{ height: 180 }} />
        <div className="skeleton" style={{ height: 320, marginTop: 24 }} />
      </main>
    );
  }

  if (state === 'missing') {
    return (
      <main className="profile">
        <div className="empty-dashed">
          <h3>Collector not found</h3>
          <p>No profile with that username.</p>
          <Link to="/sellers" className="btn-acid">All sellers</Link>
        </div>
      </main>
    );
  }

  if (state === 'error' || !profile) {
    return (
      <main className="profile">
        <div className="empty-dashed" role="alert">
          <h3>Couldn&apos;t load this profile</h3>
          <p>Something went wrong on our side.</p>
          <button className="btn-acid" onClick={() => void load()}>Retry</button>
        </div>
      </main>
    );
  }

  const activeListings = listings.filter((l) => l.status === 'active');
  const hydrated: ListingWithSeller[] = listings.map((l) => ({
    ...l,
    seller: profile,
    sellerActiveListingCount: activeListings.length,
    likes: 0,
  }));

  const messageSeller = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    const newest = activeListings[0];
    if (!newest) {
      toast('No active listings to ask about');
      return;
    }
    setMsgBusy(true);
    try {
      const conv = await client.openConversation(newest.id);
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open the conversation');
    } finally {
      setMsgBusy(false);
    }
  };

  const toggleBlock = async () => {
    setBlockBusy(true);
    try {
      await client.setBlocked(profile.id, !blocked);
      setBlocked(!blocked);
      toast(blocked ? 'Unblocked' : 'Blocked');
    } finally {
      setBlockBusy(false);
    }
  };

  return (
    <main className="profile">
      <button type="button" className="btn-ghost-mono is-muted" onClick={() => navigate('/sellers')}>
        ← All sellers
      </button>

      <div className="profile-hero">
        {profile.avatarUrl ? (
          <Avatar profile={profile} size={84} />
        ) : (
          <div
            className="profile-avatar"
            style={{ background: avatarBackground(profile.username ?? profile.id) }}
            aria-hidden="true"
          />
        )}
        <div className="profile-id">
          <div className="profile-id-top">
            <h1 className="display profile-handle">@{profile.username}</h1>
            {stats && (
              <span className={`rank-chip ${stats.rank === 1 ? 'rank-top' : ''}`}>
                Rank {String(stats.rank).padStart(2, '0')}
              </span>
            )}
          </div>
          <div className="mono-label profile-meta">
            {profile.displayName} · member since {memberSince(profile.createdAt)}
            {stats && stats.games.length > 0 &&
              ` · ${stats.games.map((g) => GAME_LABELS[g]).join(' · ')}`}
          </div>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          {noShows > 0 && (
            <p className="mono-label profile-noshow" role="note">
              ⚠ {noShows} auction no-show{noShows === 1 ? '' : 's'} reported in the last 90 days
              {noShows >= 3 ? ' — bidding is blocked' : ''}
            </p>
          )}
          {blocked && (
            <p className="profile-blocked mono-label">
              Blocked — they can&apos;t message you and you can&apos;t message them.
            </p>
          )}
        </div>
        <div className="profile-side">
          <div className="profile-stats">
            <div>
              <div className="mono-label">Reviews</div>
              <div className="mono-value profile-stat-v">
                {profile.ratingAvg !== null
                  ? `${profile.ratingAvg.toFixed(1)} · ${profile.ratingCount}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="mono-label">Deals</div>
              <div className="mono-value profile-stat-v">{stats?.soldCount ?? 0}</div>
            </div>
            <div>
              <div className="mono-label">Listings</div>
              <div className="mono-value profile-stat-v">{activeListings.length}</div>
            </div>
          </div>
          {isOwn ? (
            <div className="profile-own-actions">
              <Link to="/my-listings" className="btn-outline">My listings</Link>
              <Link to="/settings" className="btn-outline">Settings</Link>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn-acid profile-msg"
                disabled={msgBusy || blocked}
                onClick={() => void messageSeller()}
              >
                Message seller
              </button>
              {user && (
                <div className="profile-trust-actions">
                  <button
                    type="button"
                    className="btn-ghost-mono is-muted"
                    disabled={blockBusy}
                    onClick={() => void toggleBlock()}
                  >
                    {blocked ? 'Unblock' : 'Block'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-mono is-muted"
                    onClick={() => setReportOpen(true)}
                  >
                    Report
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="section-head profile-listings-head">
        <h2>Listings</h2>
        <div className="mono-label">
          {String(isOwn ? listings.length : activeListings.length).padStart(2, '0')}{' '}
          {isOwn ? 'total' : 'active'}
        </div>
      </div>
      {hydrated.length === 0 ? (
        <div className="empty-dashed">
          <h3>No listings</h3>
          <p>{isOwn ? 'List a card to get started.' : 'Nothing for sale right now.'}</p>
          {isOwn && <Link to="/sell" className="btn-acid">List a card</Link>}
        </div>
      ) : (
        <div className="profile-grid">
          {hydrated.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      <div className="section-head profile-reviews-head">
        <h2>Reviews</h2>
        <div className="mono-label">{String(reviews.length).padStart(2, '0')} received</div>
      </div>
      {reviews.length === 0 ? (
        <p className="profile-noreviews">
          No reviews yet — reviews unlock after a completed deal.
        </p>
      ) : (
        <div className="profile-reviews">
          {reviews.map((r) => (
            <div key={r.id} className="panel profile-review">
              <div className="profile-review-head">
                <span className="profile-review-name">{r.reviewer.displayName}</span>
                <span className="mono-value profile-review-stars">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </span>
                <span className="mono-label profile-review-time">{relativeTime(r.createdAt)}</span>
              </div>
              {r.body && <p className="profile-review-body">{r.body}</p>}
            </div>
          ))}
        </div>
      )}

      {reportOpen && (
        <ReportDialog
          targetType="user"
          targetId={profile.id}
          targetLabel={`@${profile.username}`}
          onClose={() => setReportOpen(false)}
        />
      )}
    </main>
  );
}
