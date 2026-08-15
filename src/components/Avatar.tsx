import { useMemo } from 'react';
import type { Profile } from '../lib/types';
import { avatarBackground } from '../lib/face';
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
        className="avatar-img"
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          background: avatarBackground(profile.username ?? profile.id),
        }}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      className="avatar-img"
      src={src}
      width={size}
      height={size}
      alt=""
      style={{ width: size, height: size }}
    />
  );
}
