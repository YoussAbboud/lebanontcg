import { useMemo } from 'react';
import type { Profile } from '../lib/types';
import { useApp } from '../state/AppContext';

export function Avatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const { client } = useApp();
  const src = useMemo(
    () => (profile.avatarUrl ? client.resolveImageUrl(profile.avatarUrl) : null),
    [client, profile.avatarUrl],
  );
  if (!src) {
    return (
      <span
        className="avatar"
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: size * 0.42,
          color: 'var(--text-2)',
        }}
        aria-hidden="true"
      >
        {profile.displayName.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      src={src}
      width={size}
      height={size}
      alt=""
      style={{ width: size, height: size }}
    />
  );
}
