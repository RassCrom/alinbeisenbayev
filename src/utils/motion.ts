/*
 * The two questions every piece of motion asks before it runs. Read at the
 * moment of use, not cached: a visitor can change either while the page is
 * open (plug in a mouse, switch on reduced motion).
 */

/** The visitor has asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The primary pointer is precise: a mouse or trackpad, not a finger. */
export function hasFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}
