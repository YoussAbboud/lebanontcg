import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Profile } from '../lib/types';
import { useApp } from '../state/AppContext';
import { Avatar } from '../components/Avatar';
import './settings.css';

export function SettingsPage() {
  const { client, user } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');
  const [blockedProfiles, setBlockedProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when identity changes

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    client.getBlockedIds().then(async (ids) => {
      const profiles = await Promise.all([...ids].map((id) => client.getProfile(id)));
      if (!cancelled) setBlockedProfiles(profiles.filter((p): p is Profile => p !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [client, user]);

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Settings</h3>
        <p>Sign in to manage your profile.</p>
        <Link to="/signin" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState('busy');
    try {
      await client.updateProfile({ displayName: displayName.trim(), bio: bio.trim() });
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    }
  };

  const unblock = async (id: string) => {
    await client.setBlocked(id, false);
    setBlockedProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="settings">
      <h1 className="display settings-title">Settings</h1>

      <form className="settings-section panel" onSubmit={save}>
        <h2 className="microlabel settings-section-title">Profile</h2>
        <div className="settings-identity">
          <Avatar profile={user} size={64} />
          <div>
            <p className="settings-username">
              @{user.username ?? '—'}
              <span className="settings-username-note">usernames are permanent</span>
            </p>
          </div>
        </div>
        <label className="field">
          <span className="field-label">Display name</span>
          <input
            className="input"
            value={displayName}
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Bio</span>
          <textarea
            className="textarea"
            rows={3}
            maxLength={400}
            placeholder="What you collect, where you trade, how you ship…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        {saveState === 'error' && (
          <p className="field-error" role="alert">Couldn&apos;t save — try again.</p>
        )}
        <div className="settings-save-row">
          {saveState === 'saved' && <span className="settings-saved" role="status">Saved ✓</span>}
          <button className="btn btn-primary" disabled={saveState === 'busy' || !displayName.trim()}>
            {saveState === 'busy' ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <section className="settings-section panel" aria-label="Blocked users">
        <h2 className="microlabel settings-section-title">Blocked users</h2>
        {blockedProfiles.length === 0 ? (
          <p className="settings-muted">
            Nobody blocked. Block someone from their profile or a chat thread and they&apos;ll
            appear here.
          </p>
        ) : (
          <ul className="settings-blocked">
            {blockedProfiles.map((p) => (
              <li key={p.id}>
                <Avatar profile={p} size={32} />
                <span className="settings-blocked-name">
                  <strong>{p.displayName}</strong>
                  <span>@{p.username}</span>
                </span>
                <button className="btn btn-quiet btn-sm" onClick={() => void unblock(p.id)}>
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section panel" aria-label="Account">
        <h2 className="microlabel settings-section-title">Account</h2>
        <p className="settings-muted">
          Signed in as <strong>{user.displayName}</strong>
          {client.isMock && ' (mock mode — use the Dev switcher to change users)'}.
        </p>
        <button
          className="btn btn-danger btn-sm settings-signout"
          onClick={() => void client.signOut()}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
