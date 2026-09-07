import { Link, useParams } from 'react-router-dom';
import StoryCard from '../components/StoryCard/StoryCard';
import { stories } from '../data/stories';
import { articles } from '../content/blog';
import { formatStoryByline, formatStoryDate } from '../utils/story';
import { usePageMeta } from '../hooks/usePageMeta';
import NotFoundPage from './NotFoundPage';

/**
 * A story's page on this domain — its permanent record, the same way
 * /works/:slug is a project's. The piece itself may read elsewhere (every one
 * does today, see `Story.external`); this page carries the standfirst, the
 * credits and the colophon, and hands the reader on. When a piece is authored
 * in-repo this route becomes the piece, and the record folds into its foot.
 */
export default function StoryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const story = stories.find((s) => s.slug === slug);

  // Before the not-found branch — hooks can't sit behind a conditional return.
  // NotFoundPage sets its own title/robots when it renders, so skip ours then.
  usePageMeta(story?.title, story?.dek, { enabled: Boolean(story) });

  // An unknown slug is a miss like any other — same sheet, same noindex.
  if (!story) return <NotFoundPage />;

  /*
   * Method notes are declared on the story (`postSlugs`) and resolved here, in
   * the one place that renders them — resolving in data/stories.ts would pull
   * every MDX article into anything that imports the stories list, WorkCard
   * included.
   */
  const methodNotes = (story.postSlugs ?? [])
    .map((postSlug) => articles.find((a) => a.slug === postSlug))
    .filter((a): a is (typeof articles)[number] => Boolean(a));

  const host = story.external ? new URL(story.url).host : null;

  const colophon: [string, string][] = [
    ['Published', formatStoryDate(story.date)],
    ['Authors', formatStoryByline(story.byline)],
    ['Format', story.format],
  ];
  if (story.subject.length > 0) colophon.push(['Subjects', story.subject.join('; ')]);
  if (story.sources?.length) colophon.push(['Sources', story.sources.join('; ')]);
  if (host) colophon.push(['Reads at', host]);

  const more = stories.filter((s) => s.slug !== story.slug).slice(0, 2);
  const externalProps = story.external ? { target: '_blank', rel: 'noreferrer' } : {};

  return (
    <article>
      {/* Cover hero — same treatment as a case study's. */}
      <header className="relative h-[45vh] overflow-hidden md:h-[60vh]">
        <img
          src={story.coverImage}
          alt={story.title}
          width={1200}
          height={630}
          {...{ fetchpriority: 'high' }}
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'var(--gradient-overlay)' }} />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-[var(--space-6)] pb-[var(--space-8)]">
          {story.award && (
            <span className="mb-[var(--space-3)] inline-block rounded-[var(--radius-sm)] bg-[rgba(var(--color-chrome-rgb),0.8)] px-[var(--space-3)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-gold)]">
              {'★'} {story.award}
            </span>
          )}
          <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold md:text-[length:var(--text-4xl)]">
            {story.title}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-[var(--space-6)] pb-[var(--space-16)]">
        {/* Standfirst */}
        <p className="mt-[var(--space-8)] font-[family-name:var(--font-body)] text-[length:var(--text-xl)] leading-relaxed text-[var(--color-text-secondary)]">
          {story.dek}
        </p>

        {/* Byline row */}
        <p className="mt-[var(--space-4)] font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          By {formatStoryByline(story.byline)} · {formatStoryDate(story.date)}
        </p>

        {/* Meta pills */}
        <div className="mt-[var(--space-4)] flex flex-wrap items-center gap-[var(--space-2)]">
          <span className="meta-pill">{story.format}</span>
          {story.subject.map((subject) => (
            <span key={subject} className="meta-pill">
              {subject}
            </span>
          ))}
        </div>

        {/* The point of the page */}
        <div className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-3)]">
          <a href={story.url} {...externalProps} className="btn btn-primary">
            Read the story {story.external ? '↗' : '→'}
          </a>
          {story.workSlug && (
            <Link to={`/works/${story.workSlug}`} className="btn btn-secondary">
              How it was made →
            </Link>
          )}
        </div>

        {/* Method notes — the blog articles behind the piece. */}
        {methodNotes.length > 0 && (
          <section className="mt-[var(--space-12)]">
            <p className="mono-label">Method notes</p>
            <ul className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
              {methodNotes.map((note) => (
                <li key={note.slug}>
                  <Link
                    to={`/blog/${note.slug}`}
                    className="font-[family-name:var(--font-heading)] text-[length:var(--text-base)] font-bold text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
                  >
                    {note.frontmatter.title} →
                  </Link>
                  <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
                    {note.frontmatter.excerpt}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Colophon — the story's margin note, same register as a work page's
            source note. */}
        <aside
          aria-label="Colophon"
          className="mt-[var(--space-16)] border-t border-[var(--color-border-default)] pt-[var(--space-6)]"
        >
          <p className="mono-label">Colophon</p>
          <dl className="mt-[var(--space-4)] grid grid-cols-1 gap-x-[var(--space-8)] gap-y-[var(--space-3)] sm:grid-cols-2">
            {colophon.map(([term, value]) => (
              <div key={term}>
                <dt className="mono-label">{term}</dt>
                <dd className="mt-[2px] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] leading-relaxed text-[var(--color-text-secondary)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      {/* More stories */}
      {more.length > 0 && (
        <section className="border-t border-[var(--color-border-subtle)]">
          <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-16)]">
            <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-4)]">
              <h2 className="heading-section">More Stories</h2>
              <Link
                to="/stories"
                className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                All stories →
              </Link>
            </div>
            <div className="mt-[var(--space-8)] grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2">
              {more.map((s) => (
                <StoryCard key={s.id} story={s} headingLevel="h3" />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
