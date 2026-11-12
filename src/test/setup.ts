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
