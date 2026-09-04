import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Give up restoring after this long if the page never grows tall enough. */
const RESTORE_TIMEOUT_MS = 1000;

/**
 * Scroll without animating.
 *
 * `html { scroll-behavior: smooth }` in global.css applies to programmatic
 * scrolls too, so a plain scrollTo(0, 0) on navigation starts a *smooth*
 * animation — which the incoming route's layout change then interrupts, and
 * the page never actually reaches the top. Passing `behavior: 'instant'`
 * overrides the stylesheet for this one call.
 */
function jump(top: number): void {
  window.scrollTo({ top, left: 0, behavior: 'instant' });
}

/**
 * Scroll to the top on a new navigation, but put the reader back where they
 * were on Back and Forward.
 *
 * This replaces a blanket `window.scrollTo(0, 0)` on every pathname change,
 * which also fired on Back — so opening the twentieth work and returning to
 * the grid dropped you at the top of all twenty-nine cards.
 *
 * Restoring is not a single scrollTo: routes are lazy and their images load
 * after mount, so at the moment of navigation the document is usually far
 * shorter than the offset we want. We retry across frames until the page is
 * tall enough, then stop — or give up, having at least scrolled as far as the
 * content allows.
 */
export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  /** scrollY per history entry, keyed by react-router's per-entry location.key. */
  const positions = useRef(new Map<string, number>());

  // The browser's own restoration races ours and wins unpredictably.
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    if (previous) window.history.scrollRestoration = 'manual';
    return () => {
      if (previous) window.history.scrollRestoration = previous;
    };
  }, []);

  /*
   * Record where this entry is left off, as it happens.
   *
   * Deliberately not captured in a cleanup instead: React runs layout-effect
   * cleanups *after* the DOM has been mutated for the incoming route, so by
   * then a shorter page has already clamped window.scrollY and the position
   * we wanted is gone.
   */
  useEffect(() => {
    const key = location.key;
    const record = () => positions.current.set(key, window.scrollY);

    let frame = 0;
    const onScroll = () => {
      // Coalesce to one write per frame; scroll fires far more often than that.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        record();
      });
    };

    /*
     * Scroll alone is not enough to rely on. A click is what usually ends a
     * visit to this entry, and capturing on the way down means the position is
     * banked before any router state changes — no ordering assumptions about
     * when React commits the next route. It also covers the case where the
     * last scroll never got a frame to flush.
     */
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', record, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', record, { capture: true });
      if (frame) cancelAnimationFrame(frame);
    };
  }, [location.key]);

  useLayoutEffect(() => {
    const target =
      navigationType === 'POP' ? positions.current.get(location.key) : undefined;

    if (target === undefined || target <= 0) {
      jump(0);
      return;
    }

    let frame = 0;
    const deadline = performance.now() + RESTORE_TIMEOUT_MS;

    const attempt = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      jump(Math.min(target, Math.max(0, maxScroll)));
      // Done once the document is tall enough to actually hold the offset.
      if (maxScroll >= target || performance.now() > deadline) return;
      frame = requestAnimationFrame(attempt);
    };

    attempt();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [location.key, navigationType]);

  return null;
}
