import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { articles } from '../content/blog';
import { projects } from '../data/projects';
import { stories } from '../data/stories';
import ChapterNav from '../components/ChapterNav/ChapterNav';
import WorkCard from '../components/WorkCard/WorkCard';
import StoryCard from '../components/StoryCard/StoryCard';
import aboutData from '../data/about-story.json';
import type { AboutStoryData } from '../types';
import { usePageMeta } from '../hooks/usePageMeta';
import NotFoundPage from './NotFoundPage';

const { profile } = aboutData as unknown as AboutStoryData;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const index = articles.findIndex((a) => a.slug === slug);
  const article = index >= 0 ? articles[index] : undefined;
  const bodyRef = useRef<HTMLDivElement>(null);

  // Before the not-found branch — hooks can't sit behind a conditional return.
  // NotFoundPage sets its own title/robots when it renders, so skip ours then.
  usePageMeta(article?.frontmatter.title, article?.frontmatter.excerpt, {
    enabled: Boolean(article),
  });

  /*
   * Reading time, measured rather than declared. The MDX body only exists as a
   * component, so the honest word count comes from the rendered text — after
   * mount, which is fine: the number sits in the meta row, not in anything
   * layout depends on. ~200 wpm, never shown as less than a minute.
   */
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const words = (el.innerText.match(/\S+/g) ?? []).length;
    setMinutes(Math.max(1, Math.round(words / 200)));
  }, [slug]);

  // An unknown slug is a miss like any other — same sheet, same noindex.
  if (!article) return <NotFoundPage />;

  const { Component, frontmatter } = article;

  /*
   * The cross-links that make this one of three doors into the same work:
   * `workSlug` points at the case study, `storySlug` at the published piece.
   * Declared in the post's frontmatter, resolved here so a typo'd slug melts
   * to "no card" rather than a broken link.
   */
  const relatedProject = frontmatter.workSlug
    ? projects.find((p) => p.slug === frontmatter.workSlug)
    : undefined;
  const relatedStory = frontmatter.storySlug
    ? stories.find((s) => s.slug === frontmatter.storySlug)
    : undefined;

  // `articles` is newest-first, so the next read chronologically is index - 1.
  const newer = index > 0 ? articles[index - 1] : undefined;
  const older = index < articles.length - 1 ? articles[index + 1] : undefined;

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
        {frontmatter.excerpt && (
          <p className="mt-[var(--space-3)] font-[family-name:var(--font-body)] text-[length:var(--text-lg)] leading-relaxed text-[var(--color-text-secondary)]">
            {frontmatter.excerpt}
          </p>
        )}
        <p className="mt-[var(--space-3)] font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          By {profile.name} ·{' '}
          <time dateTime={frontmatter.date}>{fmtDate(frontmatter.date)}</time>
          {minutes !== null && ` · ${minutes} min read`}
        </p>
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

      {/* The exits — the piece this method built, and the case study about it. */}
      {(relatedProject || relatedStory) && (
        <footer className="mt-[var(--space-16)] border-t border-[var(--color-border-subtle)] pt-[var(--space-8)]">
          <p className="mono-label">From this method</p>
          <div className="mt-[var(--space-6)] grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2">
            {relatedStory && <StoryCard story={relatedStory} headingLevel="h3" />}
            {relatedProject && (
              <WorkCard
                id={relatedProject.id}
                slug={relatedProject.slug}
                title={relatedProject.title}
                year={
                  relatedProject.endDate
                    ? Number(relatedProject.endDate.slice(0, 4)) || null
                    : null
                }
                category={relatedProject.category}
                tagline={relatedProject.tagline}
                coverImage={relatedProject.coverImage}
                award={relatedProject.awards[0]}
                featured={relatedProject.featured}
                status={relatedProject.status}
                type={relatedProject.type}
              />
            )}
          </div>
        </footer>
      )}

      {/* Older / newer, in reading order. */}
      {(older || newer) && (
        <nav
          aria-label="More articles"
          className="mt-[var(--space-12)] flex flex-wrap justify-between gap-[var(--space-4)] border-t border-[var(--color-border-subtle)] pt-[var(--space-6)]"
        >
          {older ? (
            <Link
              to={`/blog/${older.slug}`}
              className="max-w-[45%] font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              ← {older.frontmatter.title}
            </Link>
          ) : (
            <span />
          )}
          {newer && (
            <Link
              to={`/blog/${newer.slug}`}
              className="max-w-[45%] text-right font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              {newer.frontmatter.title} →
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
