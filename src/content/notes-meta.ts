import notes from 'virtual:notes-meta';
import type { ArticleFrontmatter } from './blog';

/*
 * The blog posts' frontmatter without their bodies.
 *
 * src/content/blog.ts loads every post as a component, which is right for the
 * page that renders one and wrong for a list of titles. The frontmatter comes
 * from `virtual:notes-meta` (see vite.config.ts), which reads it from the
 * files at build time.
 */
const all = notes as unknown as { slug: string; frontmatter: ArticleFrontmatter }[];

/** Published posts only: same rule as `articles` in blog.ts. */
export const noteMeta = all.filter((note) => !note.frontmatter.draft && !note.frontmatter.hidden);
