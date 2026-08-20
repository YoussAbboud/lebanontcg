import { Link } from 'react-router-dom';
import type { Profile } from '../../lib/types';
import { Avatar } from '../Avatar';

/** "@handle" when there is one, the display name otherwise. */
export function handleOf(profile: Profile | null | undefined): string {
  if (!profile) return 'unknown';
  return profile.username ? `@${profile.username}` : profile.displayName;
}

/** Avatar + name + handle, linked to the public profile when reachable. */
export function PersonCell({ profile }: { profile: Profile | null }) {
  if (!profile) {
    return <span className="aperson-missing mono-label">Deleted account</span>;
  }
  const inner = (
    <>
      <Avatar profile={profile} size={30} />
      <span className="aperson-id">
        <strong>{profile.displayName}</strong>
        <span className="aperson-handle">{handleOf(profile)}</span>
      </span>
    </>
  );
  return profile.username ? (
    <Link to={`/u/${profile.username}`} className="aperson">
      {inner}
    </Link>
  ) : (
    <span className="aperson">{inner}</span>
  );
}

/**
 * Mono status chip. `tone` is the only place admin surfaces reach for
 * color: acid for live/ok, pink for suspended/removed, plain otherwise.
 */
export function Chip({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'acid' | 'danger' | 'warn';
}) {
  return <span className={`achip achip-${tone}`}>{children}</span>;
}

/** The audit log's detail blob, rendered as compact key=value mono text. */
export function detailSummary(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' · ');
}
