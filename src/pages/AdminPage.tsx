import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AdminAction, AdminStats } from '../lib/types';
import { useApp } from '../state/AppContext';
import { AdminOverview } from '../components/admin/AdminOverview';
import { AdminReports } from '../components/admin/AdminReports';
import { AdminUsers } from '../components/admin/AdminUsers';
import { AdminListings } from '../components/admin/AdminListings';
import { AdminAuctions } from '../components/admin/AdminAuctions';
import { AdminReviews } from '../components/admin/AdminReviews';
import { AdminAudit } from '../components/admin/AdminAudit';
import './admin.css';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'reports', label: 'Reports' },
  { key: 'users', label: 'Users' },
  { key: 'listings', label: 'Listings' },
  { key: 'auctions', label: 'Auctions' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'audit', label: 'Audit log' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminPage() {
  const { user, auth, client } = useApp();
  // The tab lives in the URL so one moderator can send another straight
  // to what they were looking at.
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') ?? 'overview';
  const tab = (TABS.some((t) => t.key === raw) ? raw : 'overview') as TabKey;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recent, setRecent] = useState<AdminAction[]>([]);

  const isAdmin = Boolean(user?.isAdmin);

  const refresh = useCallback(() => {
    if (!isAdmin) return;
    client.getAdminStats().then(setStats).catch(() => setStats(null));
    client.adminListActions(6).then(setRecent).catch(() => setRecent([]));
  }, [client, isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const go = (next: string) => setParams(next === 'overview' ? {} : { tab: next });

  if (auth.loading) {
    return (
      <main className="admin">
        <div className="skeleton" style={{ height: 420 }} />
      </main>
    );
  }

  // One message for "not signed in" and "signed in, not an admin": the
  // console's existence isn't a secret, but its shape shouldn't leak.
  if (!isAdmin) {
    return (
      <main className="admin">
        <div className="empty-dashed">
          <h3>Admins only</h3>
          <p>
            {user
              ? 'This account does not have moderator access.'
              : 'Sign in with a moderator account to continue.'}
          </p>
          {user ? (
            <Link to="/" className="btn-acid">
              Back to the marketplace
            </Link>
          ) : (
            <Link to="/signin" className="btn-acid">
              Sign in
            </Link>
          )}
        </div>
      </main>
    );
  }

  const openCount = stats ? stats.reportsOpen : 0;

  return (
    <main className="admin">
      <div className="section-head admin-head">
        <h1>Admin console</h1>
        <div className="mono-label">
          {user?.username ? `@${user.username}` : user?.displayName} · every action is logged
        </div>
      </div>

      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="pill"
            aria-pressed={tab === t.key}
            onClick={() => go(t.key)}
          >
            {t.label}
            {t.key === 'reports' && openCount > 0 && (
              <span className="admin-tab-badge" aria-label={`${openCount} open`}>
                {openCount > 99 ? '99+' : openCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <AdminOverview stats={stats} recent={recent} onGo={go} />}
      {tab === 'reports' && <AdminReports onChanged={refresh} />}
      {tab === 'users' && <AdminUsers onChanged={refresh} />}
      {tab === 'listings' && <AdminListings onChanged={refresh} />}
      {tab === 'auctions' && <AdminAuctions onChanged={refresh} />}
      {tab === 'reviews' && <AdminReviews onChanged={refresh} />}
      {tab === 'audit' && <AdminAudit />}
    </main>
  );
}
