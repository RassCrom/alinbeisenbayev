import type { ComponentType } from 'react';

/**
 * Bodies for in-repo stories — one .mdx file per piece under ./stories/,
 * filename matching the story's `slug` in src/data/stories.json. Metadata
 * (title, dek, byline, date, format, subject, coverImage…) still lives in
 * stories.json, same as every other story; the .mdx file supplies only the
 * prose that StoryDetailPage renders in place of the "Read the story ↗" link
 * when that story's `external` is false.
 *
 * Kept separate from src/data/stories.ts on purpose: that file is imported
 * by LandingPage, WorkCard and WorkDetailPage for metadata alone, and eagerly
 * pulling every story's MDX component in there would ship every story body
 * on pages that never render one. Only StoryDetailPage imports this module.
 */
const modules = import.meta.glob<{ default: ComponentType }>('./stories/*.mdx', {
  eager: true,
});

export const storyBodies: Record<string, ComponentType> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [
    path.replace('./stories/', '').replace(/\.mdx$/, ''),
    mod.default,
  ]),
);
