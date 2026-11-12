import type { ArticleFrontmatter } from './blog';

/*
 * The blog posts' frontmatter without their bodies.
 *
 * src/content/blog.ts loads every post as a component, which is right for the
 * page that renders one and wrong for a list of titles: the journal index and
 * the home page would ship every post's text to show three cards. This asks
 * for the `frontmatter` export alone.
 */
const modules = import.meta.glob<ArticleFrontmatter>('./blog/*.mdx', {
  eager: true,
  import: 'frontmatter',
});

/** Published posts only: same rule as `articles` in blog.ts. */
export const noteMeta: { slug: string; frontmatter: ArticleFrontmatter }[] = Object.entries(modules)
  .map(([path, frontmatter]) => ({
    slug: path.replace('./blog/', '').replace(/\.mdx$/, ''),
    frontmatter,
  }))
  .filter((note) => !note.frontmatter.draft && !note.frontmatter.hidden);
