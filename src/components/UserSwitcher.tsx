import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../lib/types';
import { useApp } from '../state/AppContext';
import { Avatar } from './Avatar';
import './userswitcher.css';

/**
 * Dev-only user switcher (mock mode). Instant sign-in as any seeded user —
 * open two tabs as two different users to exercise chat end-to-end.
 */
export function UserSwitcher() {
  const { client, user } = useApp();
  const [users, setUsers] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.listMockUsers().then(setUsers);
  }, [client]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="uswitch" ref={ref}>
      <button
        className="uswitch-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Mock mode: switch user"
      >
        <span className="uswitch-dot" aria-hidden="true" />
        {user ? `Dev: ${user.displayName.split(' ')[0]}` : 'Dev: sign in'}
      </button>
      {open && (
        <div className="uswitch-menu glass" role="menu">
          <p className="microlabel uswitch-title">Mock users</p>
          {users.map((u) => (
            <button
              key={u.id}
              role="menuitem"
              className="uswitch-item"
              aria-current={u.id === user?.id}
              onClick={async () => {
                await client.signInAsMockUser(u.id);
                setOpen(false);
              }}
            >
              <Avatar profile={u} size={28} />
              <span className="uswitch-item-name">
                <strong>{u.displayName}</strong>
                <span>@{u.username}</span>
              </span>
              {u.id === user?.id && <span className="uswitch-check" aria-hidden="true">✓</span>}
            </button>
          ))}
          {user && (
            <button
              role="menuitem"
              className="uswitch-item uswitch-signout"
              onClick={async () => {
                await client.signOut();
                setOpen(false);
              }}
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
