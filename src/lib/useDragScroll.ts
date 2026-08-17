import { useEffect, type RefObject } from 'react';

/**
 * Mouse drag-to-scroll for an overflow-x container. Touch already scrolls
 * natively, so only mouse pointers are handled. While a drag is live the
 * container gets an `is-dragscroll` class (used to suspend scroll-snap so
 * it doesn't fight the hand), and the click that ends a drag is swallowed
 * so dragging across a card doesn't open it.
 *
 * `enabled` must flip to true only once the container is actually in the
 * DOM — the ref is null on first mount when the element renders behind a
 * data load, and a ref change alone never re-runs an effect.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        el.classList.add('is-dragscroll');
      }
      if (moved) {
        el.scrollLeft = startLeft - dx;
        e.preventDefault();
      }
    };
    /**
     * Re-enabling mandatory snap right on release rewinds any drag shorter
     * than half a card. Settle ourselves instead: a deliberate drag (past
     * 40px) always reaches the next card in the drag direction, a longer
     * one rounds to the nearest, and snap comes back once we've arrived.
     */
    const settle = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const step = first ? first.getBoundingClientRect().width + gap : 0;
      if (step > 0) {
        const delta = el.scrollLeft - startLeft;
        let target = Math.round(el.scrollLeft / step) * step;
        if (Math.abs(delta) > 40 && Math.abs(delta) < step / 2) {
          target = (delta > 0 ? Math.ceil : Math.floor)(el.scrollLeft / step) * step;
          if (delta > 0 && target <= startLeft) target = startLeft + step;
        }
        el.scrollTo({ left: target, behavior: 'smooth' });
      }
      window.setTimeout(() => el.classList.remove('is-dragscroll'), 350);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      if (moved) settle();
      else el.classList.remove('is-dragscroll');
    };
    const click = (e: MouseEvent) => {
      if (moved) {
        // The release of a drag lands as a click on whatever card is
        // under the pointer — that's the end of a scroll, not a click.
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    const dragstart = (e: DragEvent) => {
      if (dragging) e.preventDefault(); // images would start a native drag
    };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('click', click, true);
    el.addEventListener('dragstart', dragstart);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('click', click, true);
      el.removeEventListener('dragstart', dragstart);
    };
  }, [ref, enabled]);
}
