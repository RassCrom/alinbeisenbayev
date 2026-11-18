import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

/** Every file under a directory. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

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
  'src/pages/WorksPage.tsx',
  'src/pages/WorkDetailPage.tsx',
  'src/components/StoryCallout/StoryCallout.tsx',
  'src/components/SourceNote/SourceNote.tsx',
  'src/data/journal.ts',
  'src/content/notes-meta.ts',
  'src/pages/JournalPage.tsx',
  'src/pages/JournalEntryPage.tsx',
  'src/components/JournalCard/JournalCard.tsx',
  'src/components/ChapterNav/ChapterNav.tsx',
  'src/components/LegacyRedirect/LegacyRedirect.tsx',
  'src/shared/inquiry.ts',
  'src/server/contact.ts',
  'src/components/Field/Field.tsx',
  'src/components/ContactForm/ContactForm.tsx',
  'src/pages/ContactPage.tsx',
  'src/pages/AboutPage.tsx',
  'src/pages/NotFoundPage.tsx',
  'src/components/FieldCamp/FieldCamp.tsx',
  'src/styles/field-camp.css',
  'src/data/proof.ts',
  'src/components/AwardsMap/AwardsMap.tsx',
  'src/components/AwardsMap/AwardsMap.css',
  'src/components/AwardsMap/glyphs.tsx',
  'src/utils/ortelius.ts',
  'src/hooks/useCopy.ts',
  'src/components/Palette/Palette.tsx',
  'src/components/Compare/Compare.tsx',
  'src/components/DownloadCard/DownloadCard.tsx',
  'src/data/gta-palettes.ts',
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

it('has no atlas left in it', () => {
  // Retired by the redesign. The code lives on in the main and experiment-map branches.
  expect(existsSync('src/atlas')).toBe(false);
  expect(existsSync('public/atlas')).toBe(false);
  expect(readFileSync('package.json', 'utf8')).not.toMatch(/atlas/);
  const sources = [...walk('src'), ...walk('scripts')].filter((file) => /\.(ts|tsx|mjs|py|css)$/.test(file));
  const mentions = sources.filter(
    (file) => !file.endsWith('redesigned.test.ts') && /atlas/i.test(readFileSync(file, 'utf8').replace(/Atlas of Sustainability/g, '')),
  );
  expect(mentions).toEqual([]);
});
