import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

/*
 * Files rebuilt on the new design system. Each must follow its type and copy
 * rules: Geologica only, no italics, no letter-spaced capitals, no legacy
 * tokens or primitives. A plan that rebuilds a page appends its files here.
 */
export const REDESIGNED: string[] = [];

const BANNED: RegExp[] = [
  /\bitalic\b/,
  /\buppercase\b/,
  /mono-label/,
  /font-mono/,
  /--color-/,
  /tracking-\[0\.\d/,
  /coord-label/,
  /\bpill\b/,
];

it.each(REDESIGNED.length ? REDESIGNED : ['(none yet)'])('%s follows the type and copy rules', (file) => {
  if (file === '(none yet)') return;
  const source = readFileSync(file, 'utf8');
  for (const rule of BANNED) expect(source, `${file} uses ${rule}`).not.toMatch(rule);
});

it('base styles carry no grain, contour background or custom cursor', () => {
  const css = readFileSync('src/styles/global.css', 'utf8');
  expect(css).not.toMatch(/feTurbulence|astana-contours|has-custom-cursor|cursor-pointer-el/);
});
