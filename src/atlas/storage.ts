/*
 * The flags the atlas remembers between visits, all under one prefix in
 * localStorage, behind one pair of functions: private mode and a full
 * store throw, and every caller wants the same answer to that, "carry on
 * as if it were unset". The survey set (fog.ts), the weather cache and the
 * view mode keep their own keys and their own shapes.
 */

export const FLAG_KEYS = {
  /** The first-visit flight has been shown. */
  flown: 'atlas:flown',
  /** The "how to read this map" panel has been closed once. */
  explained: 'atlas:explained',
  /** Every settlement has been explored once; the note was shown. */
  completed: 'atlas:completed',
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];

/** True when the flag was set; false when unset or when storage cannot be read. */
export function readFlag(key: FlagKey): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: FlagKey): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Nothing to do: the visitor sees the thing again next time; no harm.
  }
}
