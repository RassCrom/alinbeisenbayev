import { useCallback, useSyncExternalStore } from 'react';

/*
 * Which face the home route shows: the atlas ("map") or the landing page
 * ("sheet"). The choice persists in localStorage. Without a stored choice
 * the default is the map, except where the map would be a poor first
 * impression: reduced motion, a narrow viewport, or no WebGL2, in which
 * case the sheet wins. No WebGL2 also overrides a stored "map", because the
 * atlas cannot draw without it.
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
const listeners = new Set<() => void>();

/**
 * Not cached: until the visitor chooses, the default is recomputed on every
 * read so a viewport that was narrow for one early frame does not pin the
 * sheet for the whole visit.
 */
function current(): ViewMode {
  if (!atlasSupported()) return 'sheet';
  return sessionChoice ?? readStored() ?? defaultViewMode();
}

export function setViewMode(next: ViewMode): void {
  sessionChoice = next;
  try {
    localStorage.setItem(VIEW_MODE_KEY, next);
  } catch {
    // Private mode or a full store: sessionChoice still holds for this visit.
  }
  for (const listener of listeners) listener();
}

/**
 * Besides explicit choices, the default itself can change while nothing is
 * stored: a window crossing the narrow threshold, or a motion preference
 * toggled. Re-evaluate on those too, so an early narrow layout frame does
 * not decide the whole visit.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onEnvironment = (): void => {
    if (sessionChoice === null && readStored() === null) listener();
  };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener('resize', onEnvironment);
  motion.addEventListener('change', onEnvironment);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('resize', onEnvironment);
    motion.removeEventListener('change', onEnvironment);
  };
}

export function useViewMode(): { mode: ViewMode; setMode: (next: ViewMode) => void; supported: boolean } {
  const value = useSyncExternalStore(subscribe, current, () => 'sheet' as ViewMode);
  const setMode = useCallback((next: ViewMode) => setViewMode(next), []);
  return { mode: value, setMode, supported: atlasSupported() };
}
