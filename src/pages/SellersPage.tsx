import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SellerStats } from '../lib/types';
import { GAME_LABELS } from '../lib/types';
import { avatarBackground } from '../lib/face';
import { memberSince } from '../lib/format';
import { useApp } from '../state/AppContext';
import { Avatar } from '../components/Avatar';
import './sellers.css';

export function SellersPage() {
  const { client } = useApp();
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<SellerStats[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .listSellers(24)
      .then((s) => {
        if (!cancelled) setSellers(s);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <main className="sellers">
      <button type="button" className="btn-ghost-mono is-muted" onClick={() => navigate('/')}>
        ← Back to home
      </button>
      <div className="section-head sellers-head">
        <h1>Browse sellers</h1>
        <div className="mono-label">Ranked by reviews, rating and live inventory</div>
      </div>

      {error && (
        <div className="empty-dashed" role="alert">
          <h3>Couldn&apos;t load sellers</h3>
          <p>Something went wrong on our side.</p>
          <button className="btn-acid" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {!sellers && !error && (
        <div className="sellers-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 180 }} />
          ))}
        </div>
      )}

      {sellers && (
        <div className="sellers-grid">
          {sellers.map((s) => (
            <article
              key={s.profile.id}
              role="button"
              tabIndex={0}
              className="sellers-card"
              onClick={() => s.profile.username && navigate(`/u/${s.profile.username}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && s.profile.username) navigate(`/u/${s.profile.username}`);
              }}
            >
              <div className="sellers-card-top">
                {s.profile.avatarUrl ? (
                  <Avatar profile={s.profile} size={48} />
                ) : (
                  <div
                    className="sellers-avatar"
                    style={{ background: avatarBackground(s.profile.username ?? s.profile.id) }}
                    aria-hidden="true"
                  />
                )}
                <div className="sellers-names">
                  <div className="sellers-handle">@{s.profile.username ?? s.profile.displayName}</div>
                  <div className="sellers-region">member since {memberSince(s.profile.createdAt)}</div>
                </div>
                <div className="sellers-rank">
                  <span className={`rank-chip ${s.rank === 1 ? 'rank-top' : ''}`}>
                    {String(s.rank).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <div className="mono-label sellers-games">
                {s.games.length ? s.games.map((g) => GAME_LABELS[g]).join(' · ') : 'No live listings'}
              </div>
              <div className="sellers-stats">
                <div>
                  <div className="mono-label">Rating</div>
                  <div className="mono-value sellers-stat-v">
                    {s.profile.ratingAvg !== null
                      ? `${s.profile.ratingAvg.toFixed(1)} · ${s.profile.ratingCount}`
                      : '—'}
                  </div>
                </div>
                <div className="sellers-stat-mid">
                  <div className="mono-label">Deals</div>
                  <div className="mono-value sellers-stat-v">{s.soldCount}</div>
                </div>
                <div className="sellers-stat-right">
                  <div className="mono-label">Listings</div>
                  <div className="mono-value sellers-stat-v">{s.activeCount}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
