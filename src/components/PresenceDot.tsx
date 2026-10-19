/**
 * Presence, always shown: green while the person is on the site, grey
 * when they are not — so the absence of green is a statement, not a
 * missing feature.
 */
export function PresenceDot({ online, large = false }: { online: boolean; large?: boolean }) {
  return (
    <span
      className={`online-dot ${online ? 'is-online' : 'is-offline'}${large ? ' online-dot-lg' : ''}`}
      role="img"
      aria-label={online ? 'Online' : 'Offline'}
      title={online ? 'Online now' : 'Not on the site right now'}
    />
  );
}
