import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

/*
 * Files rebuilt on the new design system. Each must follow its type and copy
 * rules: Geologica only, no italics, no letter-spaced capitals, no legacy
 * tokens or primitives. A plan that rebuilds a page appends its files here.
 */
export const REDESIGNED: string[] = [
  'src/styles/system.css',
  'src/components/Icon/Icon.tsx',
  'src/components/Button/Button.tsx',
  'src/components/Skeleton/Skeleton.tsx',
  'src/components/Frame/Frame.tsx',
  'src/components/Nav/Nav.tsx',
  'src/components/WorkCard/WorkCard.tsx',
  'src/hooks/useTilt.ts',
  'src/utils/tilt.ts',
  'src/utils/motion.ts',
  'src/data/offers.ts',
  'src/data/featured.ts',
  'src/components/HeroStack/HeroStack.tsx',
  'src/components/JournalCard/JournalCard.tsx',
  'src/pages/HomePage.tsx',
  'src/components/ContactBand/ContactBand.tsx',
  'src/components/Footer/Footer.tsx',
  'src/components/PageFallback/PageFallback.tsx',
  'src/App.tsx',
  'src/data/works.ts',
  'src/components/PieceCard/PieceCard.tsx',
  'src/components/FilterChip/FilterChip.tsx',
];

const BANNED: RegExp[] = [
  /\bitalic\b/,
  /\buppercase\b/,
  /mono-label/,
  /font-mono/,
  /--color-/,
  /tracking-\[0\.\d/,
  /coord-label/,
  // The legacy `pill` class, not the --r-pill radius token.
  /(?<![-\w])pill(?![-\w])/,
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
