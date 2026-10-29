/** The fan carousel's geometry that other code needs: which cards are on
    screen when it first appears. Kept out of the component so the home page
    can preload exactly those covers and nothing more. */

/** Cards on screen at once: the centre and three to each side. */
export const FAN_WINDOW = 3;

/** The card the fan opens on (the third, so there are cards to both sides). */
export function fanInitialActive(count: number): number {
  return Math.min(2, Math.max(0, count - 1));
}

/** The items visible at first paint, in list order; all of them when
    there are seven or fewer. */
export function fanInitialWindow<T>(items: readonly T[]): T[] {
  const n = items.length;
  if (n <= FAN_WINDOW * 2 + 1) return [...items];
  const active = fanInitialActive(n);
  const seen = new Set<number>();
  for (let off = -FAN_WINDOW; off <= FAN_WINDOW; off++) seen.add((((active + off) % n) + n) % n);
  return items.filter((_, i) => seen.has(i));
}
