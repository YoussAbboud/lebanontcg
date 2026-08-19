import { useEffect, useState } from 'react';

/**
 * A ticking clock for countdowns. Always compute display time from the
 * target timestamp and this value — never decrement — so the countdown
 * is correct immediately after a backgrounded tab wakes up (browsers
 * throttle timers; visibilitychange forces a fresh read).
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}
