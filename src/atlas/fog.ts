import { useSyncExternalStore } from 'react';

/*
 * Fog of war. Islands start under a thin fog; a settlement is "surveyed"
 * once the visitor hovers it on the map or opens its project, and the fog
 * around it clears for good. The set lives in localStorage so the survey
 * survives the visit.
 */

export const SURVEYED_KEY = 'atlas:surveyed';

let surveyed: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function load(): ReadonlySet<string> {
  if (surveyed !== null) return surveyed;
  try {
    const raw = localStorage.getItem(SURVEYED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    surveyed = new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    surveyed = new Set();
  }
  return surveyed;
}

export function getSurveyed(): ReadonlySet<string> {
  return load();
}

export function markSurveyed(slug: string): void {
  const current = load();
  if (current.has(slug)) return;
  surveyed = new Set([...current, slug]);
  try {
    localStorage.setItem(SURVEYED_KEY, JSON.stringify([...surveyed]));
  } catch {
    // Private mode or a full store: the survey still holds for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The surveyed set; a new Set identity whenever it grows. */
export function useSurveyed(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSurveyed, () => EMPTY);
}

const EMPTY: ReadonlySet<string> = new Set();
