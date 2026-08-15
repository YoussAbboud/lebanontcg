import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { useApp } from '../state/AppContext';
import { ListingCard } from '../components/ListingCard';
import './favorites.css';

export function FavoritesPage() {
  const { client, user, favoriteIds } = useApp();
  const [items, setItems] = useState<ListingWithSeller[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setItems(await client.getFavoriteListings());
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client]);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  const visible = items.filter((l) => favoriteIds.has(l.id));

  if (!user) {
    return (
      <main className="watchlist">
        <div className="empty-dashed">
          <h3>Watchlist</h3>
          <p>Sign in to keep an eye on cards you want.</p>
          <Link to="/signin" className="btn-acid">Sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="watchlist">
      <div className="section-head">
        <h1>Watchlist</h1>
        <div className="mono-label">
          {String(visible.length).padStart(2, '0')} watched · sold and reserved cards stay here
        </div>
      </div>

      {state === 'loading' && (
        <div className="watchlist-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 380, borderRadius: 'var(--r-card)' }} />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="empty-dashed" role="alert">
          <h3>Couldn&apos;t load your watchlist</h3>
          <p>Something went wrong on our side.</p>
          <button className="btn-acid" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {state === 'ready' && visible.length === 0 && (
        <div className="empty-dashed">
          <h3>Nothing watched yet</h3>
          <p>Tap the ☆ on any listing to track it here.</p>
          <Link to="/browse" className="btn-acid">Browse cards</Link>
        </div>
      )}

      {state === 'ready' && visible.length > 0 && (
        <div className="watchlist-grid">
          {visible.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </main>
  );
}
