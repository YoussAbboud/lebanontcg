import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AdminUser } from '../../lib/types';
import { memberSince } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { ReasonPrompt } from './ReasonPrompt';
import { Chip, PersonCell, handleOf } from './shared';

interface Pending {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  requireReason: boolean;
  destructive: boolean;
  run(reason: string): Promise<void>;
}

const PAGE = 25;

export function AdminUsers({ onChanged }: { onChanged(): void }) {
  const { client, user: me } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setUsers(await client.adminListUsers(query, limit));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, query, limit]);

  // Debounced so typing a handle doesn't fire a query per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const after = async (message: string) => {
    toast(message);
    onChanged();
    await load();
  };

  const suspend = (row: AdminUser) =>
    setPending({
      title: `Suspend ${handleOf(row.profile)}`,
      body: 'They keep their history and can still read, but cannot list, message or bid until this is lifted.',
      confirmLabel: 'Suspend account',
      requireReason: true,
      destructive: true,
      run: async (reason) => {
        await client.adminSetSuspended(row.profile.id, true, reason);
        await after('Account suspended');
      },
    });

  const lift = (row: AdminUser) =>
    setPending({
      title: `Lift the suspension on ${handleOf(row.profile)}`,
      body: row.profile.suspendedReason ? (
        <>Suspended for: <strong>{row.profile.suspendedReason}</strong></>
      ) : null,
      confirmLabel: 'Lift suspension',
      requireReason: false,
      destructive: false,
      run: async (reason) => {
        await client.adminSetSuspended(row.profile.id, false, reason);
        await after('Suspension lifted');
      },
    });

  const setAdmin = (row: AdminUser, grant: boolean) =>
    setPending({
      title: grant ? `Make ${handleOf(row.profile)} an admin` : `Revoke ${handleOf(row.profile)}'s admin access`,
      body: grant
        ? 'They get everything on this page: suspensions, listing removal, the audit log.'
        : 'They lose access to the admin console. Their past actions stay in the log.',
      confirmLabel: grant ? 'Grant admin' : 'Revoke admin',
      requireReason: false,
      destructive: !grant,
      run: async () => {
        await client.adminSetAdmin(row.profile.id, grant);
        await after(grant ? 'Admin access granted' : 'Admin access revoked');
      },
    });

  const clearBan = (row: AdminUser) =>
    setPending({
      title: `Clear ${handleOf(row.profile)}'s bidding block`,
      body: `Deletes the ${row.noShowCount} winner no-show report${row.noShowCount === 1 ? '' : 's'} behind the block. Use it when the reports were retaliation.`,
      confirmLabel: 'Clear bid ban',
      requireReason: true,
      destructive: false,
      run: async (reason) => {
        const n = await client.adminClearBidBan(row.profile.id, reason);
        await after(`Cleared ${n} no-show${n === 1 ? '' : 's'}`);
      },
    });

  return (
    <div className="asection">
      <div className="afilters">
        <input
          className="input input-mono asearch"
          placeholder="Search handle, name or id…"
          value={query}
          onChange={(e) => {
            setLimit(PAGE);
            setQuery(e.target.value);
          }}
          aria-label="Search accounts"
        />
      </div>

      {state === 'error' ? (
        <div className="empty-dashed">
          <h3>Couldn&apos;t load accounts</h3>
          <button className="btn-outline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : state === 'loading' && users.length === 0 ? (
        <div className="skeleton" style={{ height: 320 }} />
      ) : users.length === 0 ? (
        <div className="empty-dashed">
          <h3>No accounts match</h3>
          <p>Try a handle, a display name, or a full user id.</p>
        </div>
      ) : (
        <ul className="acards">
          {users.map((row) => {
            const p = row.profile;
            const isSelf = p.id === me?.id;
            return (
              <li key={p.id} className={`acard${p.suspendedAt ? ' acard-flagged' : ''}`}>
                <div className="acard-top">
                  <PersonCell profile={p} />
                  <span className="acard-flags">
                    {p.isAdmin && <Chip tone="acid">Admin</Chip>}
                    {p.suspendedAt && <Chip tone="danger">Suspended</Chip>}
                    {row.bidBanned && !p.suspendedAt && <Chip tone="warn">Bid-banned</Chip>}
                    {isSelf && <Chip>You</Chip>}
                  </span>
                </div>

                <dl className="ameta">
                  <div>
                    <dt className="mono-label">Joined</dt>
                    <dd>{memberSince(p.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="mono-label">Listings</dt>
                    <dd>
                      {row.activeCount} live · {row.soldCount} sold · {row.listingCount} total
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label">Rating</dt>
                    <dd>
                      {p.ratingAvg === null
                        ? 'No reviews'
                        : `${p.ratingAvg.toFixed(1)} · ${row.reviewCount} review${row.reviewCount === 1 ? '' : 's'}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label">Reports against</dt>
                    <dd>
                      {row.reportsAgainst}
                      {row.noShowCount > 0 && ` · ${row.noShowCount} no-shows`}
                    </dd>
                  </div>
                </dl>

                {p.suspendedReason && (
                  <p className="acard-note">Suspended for: {p.suspendedReason}</p>
                )}

                <div className="acard-actions">
                  {p.suspendedAt ? (
                    <button type="button" className="btn-acid" onClick={() => lift(row)}>
                      Lift suspension
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-outline btn-danger-outline"
                      onClick={() => suspend(row)}
                      disabled={isSelf}
                      title={isSelf ? 'You cannot suspend your own account' : undefined}
                    >
                      Suspend
                    </button>
                  )}
                  {p.isAdmin ? (
                    <button
                      type="button"
                      className="btn-outline btn-danger-outline"
                      onClick={() => setAdmin(row, false)}
                      disabled={isSelf}
                      title={isSelf ? 'Another admin has to revoke your access' : undefined}
                    >
                      Revoke admin
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setAdmin(row, true)}
                      disabled={Boolean(p.suspendedAt)}
                      title={p.suspendedAt ? 'Lift the suspension first' : undefined}
                    >
                      Make admin
                    </button>
                  )}
                  {row.noShowCount > 0 && (
                    <button type="button" className="btn-outline" onClick={() => clearBan(row)}>
                      Clear bid ban
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {users.length >= limit && (
        <div className="amore">
          <button type="button" className="btn-outline" onClick={() => setLimit((n) => n + PAGE)}>
            Show more
          </button>
        </div>
      )}

      {pending && (
        <ReasonPrompt
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          requireReason={pending.requireReason}
          destructive={pending.destructive}
          onConfirm={pending.run}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
