import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MarketplaceClient, AuthState } from '../lib/client/MarketplaceClient';
import type { Profile } from '../lib/types';

interface AppContextValue {
  client: MarketplaceClient;
  auth: AuthState;
  user: Profile | null;
  /** Set of listing ids the current user has favorited (kept fresh). */
  favoriteIds: Set<string>;
  toggleFavorite(listingId: string): Promise<void>;
  /** Unread message count across all conversations (header badge). */
  unreadCount: number;
  refreshUnread(): void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ client, children }: { client: MarketplaceClient; children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(client.getAuthState());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = auth.user?.id ?? null;
  const unreadTimer = useRef<number | null>(null);

  useEffect(() => client.onAuthChange(setAuth), [client]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setFavoriteIds(new Set());
      setUnreadCount(0);
      return;
    }
    client.getFavoriteIds().then((ids) => {
      if (!cancelled) setFavoriteIds(ids);
    });
    client.getTotalUnreadCount().then((n) => {
      if (!cancelled) setUnreadCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [client, userId]);

  const refreshUnread = useCallback(() => {
    // Debounced: inbox events can arrive in bursts.
    if (unreadTimer.current) window.clearTimeout(unreadTimer.current);
    unreadTimer.current = window.setTimeout(() => {
      client.getTotalUnreadCount().then(setUnreadCount).catch(() => {});
    }, 80);
  }, [client]);

  useEffect(() => {
    if (!userId) return;
    return client.subscribeToInbox(refreshUnread);
  }, [client, userId, refreshUnread]);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      const next = !favoriteIds.has(listingId);
      // Optimistic
      setFavoriteIds((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(listingId);
        else copy.delete(listingId);
        return copy;
      });
      try {
        await client.setFavorite(listingId, next);
      } catch (err) {
        setFavoriteIds((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(listingId);
          else copy.add(listingId);
          return copy;
        });
        throw err;
      }
    },
    [client, favoriteIds],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      client,
      auth,
      user: auth.user,
      favoriteIds,
      toggleFavorite,
      unreadCount,
      refreshUnread,
    }),
    [client, auth, favoriteIds, toggleFavorite, unreadCount, refreshUnread],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
