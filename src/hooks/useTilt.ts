import { useCallback, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { hasFinePointer, prefersReducedMotion } from '../utils/motion';
import { MAX_TILT_DEG, tiltFor } from '../utils/tilt';

/**
 * Lean an element toward the pointer.
 *
 * Writes `--rx` and `--ry` (in degrees) on the element and clears them when
 * the pointer leaves; the element's own CSS turns them into a transform, so
 * pointer movement never enters React's render path.
 *
 * Mouse only. A finger has no hover, so a tap would set the tilt and nothing
 * would ever clear it. It also stays flat for anyone who asked for reduced
 * motion.
 */
export function useTilt<T extends HTMLElement>(max: number = MAX_TILT_DEG): {
  ref: RefObject<T>;
  onPointerMove: (event: PointerEvent<T>) => void;
  onPointerLeave: () => void;
} {
  const ref = useRef<T>(null);

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      const el = ref.current;
      if (!el || event.pointerType !== 'mouse') return;
      if (!hasFinePointer() || prefersReducedMotion()) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const { rx, ry } = tiltFor((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, max);
      el.style.setProperty('--rx', `${rx}deg`);
      el.style.setProperty('--ry', `${ry}deg`);
    },
    [max],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
