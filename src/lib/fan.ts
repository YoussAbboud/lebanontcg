/** The fan carousel's geometry. */

/** Cards on screen at once: the centre and three to each side. */
export const FAN_WINDOW = 3;

/** The card the fan opens on (the third, so there are cards to both sides). */
export function fanInitialActive(count: number): number {
  return Math.min(2, Math.max(0, count - 1));
}
