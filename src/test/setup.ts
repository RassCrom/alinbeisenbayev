import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/*
 * jsdom has no matchMedia. Tests name the queries that should match with
 * setMedia(); everything else reports false.
 */
const matching = new Set<string>();

export function setMedia(queries: string[]): void {
  matching.clear();
  for (const query of queries) matching.add(query);
}

window.matchMedia = (query: string) =>
  ({
    matches: matching.has(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

afterEach(() => {
  cleanup();
  matching.clear();
});

/*
 * jsdom has no IntersectionObserver either. Nothing is ever "in view" until a
 * test says so with intersect(), which fires every live observer.
 */
type Callback = (entries: { isIntersecting: boolean }[]) => void;
const observers = new Set<Callback>();

class FakeIntersectionObserver {
  private readonly callback: Callback;
  constructor(callback: Callback) {
    this.callback = callback;
  }
  observe(): void {
    observers.add(this.callback);
  }
  unobserve(): void {}
  disconnect(): void {
    observers.delete(this.callback);
  }
  takeRecords(): [] {
    return [];
  }
}

(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;

export function intersect(): void {
  for (const callback of [...observers]) callback([{ isIntersecting: true }]);
}

afterEach(() => observers.clear());
