import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const CHECK_EVERY_MS = 60_000;

/**
 * A tab left open across a deploy keeps running the old code — the old
 * listing filters, the old rules — until it reloads. On each in-app
 * navigation (at most once a minute) this asks the server which build is
 * live, and if it isn't this one, turns the navigation into a full page
 * load so the new code takes over. Nothing typed is lost: it happens only
 * when the person is already leaving the page.
 */
export function useBuildFreshness(): void {
  const location = useLocation();
  const lastCheck = useRef(Date.now());
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    lastCheck.current = Date.now();
    const target = location.pathname + location.search + location.hash;
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ build?: string }>) : null))
      .then((v) => {
        if (v?.build && v.build !== __BUILD_ID__) window.location.assign(target);
      })
      .catch(() => undefined);
  }, [location.pathname, location.search, location.hash]);
}
