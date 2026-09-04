import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { articles } from '../content/blog';
import ChapterNav from '../components/ChapterNav/ChapterNav';
import { usePageMeta } from '../hooks/usePageMeta';
import NotFoundPage from './NotFoundPage';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const article = articles.find((a) => a.slug === slug);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Before the not-found branch — hooks can't sit behind a conditional return.
  // NotFoundPage sets its own title/robots when it renders, so skip ours then.
  usePageMeta(article?.frontmatter.title, article?.frontmatter.excerpt, {
    enabled: Boolean(article),
  });

  // An unknown slug is a miss like any other — same sheet, same noindex.
  if (!article) return <NotFoundPage />;

  const { Component, frontmatter } = article;

  return (
    <article className="mx-auto max-w-3xl px-[var(--space-6)] py-[var(--space-12)]">
      <Link
        to="/blog"
        className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        ← Blog
      </Link>

      <header className="mt-[var(--space-6)]">
        {frontmatter.tags && frontmatter.tags.length > 0 && (
          <div className="flex flex-wrap gap-[var(--space-2)]">
            {frontmatter.tags.map((tag) => (
              <span key={tag} className="meta-pill">
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 className="mt-[var(--space-3)] font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold md:text-[length:var(--text-4xl)]">
          {frontmatter.title}
        </h1>
        <time
          dateTime={frontmatter.date}
          className="mt-[var(--space-2)] block font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]"
        >
          {fmtDate(frontmatter.date)}
        </time>
      </header>

      {frontmatter.cover && (
        <img
          src={frontmatter.cover}
          alt=""
          width={1200}
          height={630}
          className="mt-[var(--space-8)] aspect-video w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] object-cover"
        />
      )}

      <div className="mt-[var(--space-8)]">
        <ChapterNav containerRef={bodyRef} />
      </div>

      <div ref={bodyRef} className="mdx-prose mt-[var(--space-8)]">
        <Component />
      </div>
    </article>
  );
}
