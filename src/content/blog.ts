import type { ComponentType } from 'react';

export interface ArticleFrontmatter {
  title: string;
  date: string;
  excerpt: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  hidden?: boolean;
}

export interface Article {
  slug: string;
  frontmatter: ArticleFrontmatter;
  Component: ComponentType;
}

/**
 * One .mdx file per post under ./blog/ — the filename becomes the URL slug,
 * so `my-post.mdx` renders at /blog/my-post. Frontmatter (title/date/excerpt/
 * tags) is parsed by remark-frontmatter + remark-mdx-frontmatter (wired up
 * in vite.config.ts) into a named `frontmatter` export.
 */
const modules = import.meta.glob<{
  default: ComponentType;
  frontmatter: ArticleFrontmatter;
}>('./blog/*.mdx', { eager: true });

export const articles: Article[] = Object.entries(modules)
  .map(([path, mod]) => ({
    slug: path.replace('./blog/', '').replace(/\.mdx$/, ''),
    frontmatter: mod.frontmatter,
    Component: mod.default,
  }))
  .filter((article) => !article.frontmatter.draft && !article.frontmatter.hidden)
  .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date));
