import { useCallback, useSyncExternalStore } from 'react';

/*
 * Which face the home route shows: the atlas ("map") or the landing page
 * ("sheet"). The choice persists in localStorage. Without a stored choice
 * the default is the map, except where the map would be a poor first
 * impression: reduced motion, a narrow viewport, or no WebGL2, in which
 * case the sheet wins. No WebGL2 also overrides a stored "map", because the
 * atlas cannot draw without it.
 *
 * This is an external store for useSyncExternalStore, so its snapshot must
 * only change when a listener is notified: the current mode is cached and
 * recomputed on our own events (a choice, a resize, a motion-preference
 * change), never on read. Reading window.innerWidth inside getSnapshot
 * would let two components disagree within one render, and a hidden or
 * mid-layout window that briefly reports a width of 0 could pin the sheet.
 */

export type ViewMode = 'map' | 'sheet';

export const VIEW_MODE_KEY = 'atlas:view';
const NARROW_VIEWPORT = 640;

let cachedSupport: boolean | null = null;

/** WebGL2 is what the renderer needs; checked once per page load. */
export function atlasSupported(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  try {
    const canvas = document.createElement('canvas');
    cachedSupport = canvas.getContext('webgl2') !== null;
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}

function readStored(): ViewMode | null {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    return stored === 'map' || stored === 'sheet' ? stored : null;
  } catch {
    return null;
  }
}

export function defaultViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'sheet';
  if (!atlasSupported()) return 'sheet';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'sheet';
  if (window.innerWidth < NARROW_VIEWPORT) return 'sheet';
  return 'map';
}

/** Holds the choice for this visit when localStorage refuses to. */
let sessionChoice: ViewMode | null = null;
let snapshot: ViewMode | null = null;
const listeners = new Set<() => void>();

function compute(): ViewMode {
  if (!atlasSupported()) return 'sheet';
  return sessionChoice ?? readStored() ?? defaultViewMode();
}

function getSnapshot(): ViewMode {
  if (snapshot === null) snapshot = compute();
  return snapshot;
}

/** Recompute, and notify only when the mode actually changed. */
function refresh(): void {
  const next = compute();
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setViewMode(next: ViewMode): void {
  sessionChoice = next;
  try {
    localStorage.setItem(VIEW_MODE_KEY, next);
  } catch {
    // Private mode or a full store: sessionChoice still holds for this visit.
  }
  refresh();
}

let environmentWatched = false;

/** The default depends on the window; watch it once anyone subscribes. */
function watchEnvironment(): void {
  if (environmentWatched || typeof window === 'undefined') return;
  environmentWatched = true;
  window.addEventListener('resize', refresh);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', refresh);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  watchEnvironment();
  return () => listeners.delete(listener);
}

export function useViewMode(): { mode: ViewMode; setMode: (next: ViewMode) => void; supported: boolean } {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => 'sheet' as ViewMode);
  const setMode = useCallback((next: ViewMode) => setViewMode(next), []);
  return { mode: value, setMode, supported: atlasSupported() };
}
