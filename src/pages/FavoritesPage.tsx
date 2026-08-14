import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ListingWithSeller } from '../lib/types';
import { useApp } from '../state/AppContext';
import { ListingCard } from '../components/ListingCard';
import './browse.css';

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

  // Drop cards un-favorited elsewhere without a refetch.
  const visible = items.filter((l) => favoriteIds.has(l.id));

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Favorites</h3>
        <p>Sign in to keep a shortlist of cards you&apos;re watching.</p>
        <Link to="/signin" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="browse">
      <header>
        <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Favorites</h1>
        <p style={{ color: 'var(--text-2)', marginTop: 'var(--sp-2)', fontSize: 'var(--fs-13)' }}>
          Cards you&apos;re watching. Sold and reserved cards stay here so you don&apos;t lose track.
        </p>
      </header>

      {state === 'loading' && (
        <div className="browse-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="browse-skeleton skeleton" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="empty-state" role="alert">
          <div className="empty-glyph" aria-hidden="true" />
          <h3 className="display">Couldn&apos;t load favorites</h3>
          <button className="btn btn-primary" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {state === 'ready' && visible.length === 0 && (
        <div className="empty-state">
          <div className="empty-glyph" aria-hidden="true" />
          <h3 className="display">Nothing saved yet</h3>
          <p>Tap the heart on any listing to watch it here.</p>
          <Link to="/" className="btn btn-primary">Browse cards</Link>
        </div>
      )}

      {state === 'ready' && visible.length > 0 && (
        <div className="browse-grid">
          {visible.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
