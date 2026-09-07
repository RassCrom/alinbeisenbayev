import { Link } from 'react-router-dom';
import type { Story } from '../../types';
import { formatStoryByline, formatStoryDate } from '../../utils/story';

export interface StoryCardProps {
  story: Story;
  /**
   * Front-page treatment: a wide card with the cover beside the text rather
   * than above it. The /stories index gives it to the newest piece.
   */
  lead?: boolean;
  /** h2 on the index, where the page title is the h1; h3 under a section heading. */
  headingLevel?: 'h2' | 'h3';
}

/**
 * One published piece, on the /stories index and the landing page.
 *
 * Cover and title go to the story's page on this site; the Read button goes
 * straight to the piece. The cover is hidden from the accessibility tree and
 * the tab order: two tab stops on one destination is noise for anyone not
 * using a mouse.
 */
export default function StoryCard({ story, lead = false, headingLevel = 'h2' }: StoryCardProps) {
  const Heading = headingLevel;
  const linkProps = story.external ? { target: '_blank', rel: 'noreferrer' } : {};
  const arrow = story.external ? '↗' : '→';

  return (
    <article
      className={`flex h-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-accent)] ${
        lead ? 'flex-col md:flex-row' : 'flex-col'
      }`}
    >
      <Link
        to={`/stories/${story.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className={lead ? 'md:w-1/2 md:shrink-0' : undefined}
      >
        <img
          src={story.coverImage}
          alt=""
          width={1200}
          height={630}
          loading={lead ? 'eager' : 'lazy'}
          decoding="async"
          className={`w-full object-cover ${lead ? 'aspect-video md:h-full' : 'aspect-video'}`}
        />
      </Link>

      <div
        className={`flex flex-1 flex-col gap-[var(--space-3)] p-[var(--space-6)] ${
          lead ? 'md:justify-center md:p-[var(--space-8)]' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <span className="meta-pill">{story.format}</span>
          <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            {formatStoryDate(story.date)}
          </span>
        </div>

        {story.award && (
          <span className="inline-flex w-fit items-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[rgba(var(--color-accent-gold-rgb),0.1)] px-[var(--space-3)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-gold)]">
            {'★'} {story.award}
          </span>
        )}

        <Heading
          className={`font-[family-name:var(--font-heading)] font-bold ${
            lead ? 'text-[length:var(--text-2xl)]' : 'text-[length:var(--text-xl)]'
          }`}
        >
          <Link
            to={`/stories/${story.slug}`}
            className="transition-colors hover:text-[var(--color-accent-light)]"
          >
            {story.title}
          </Link>
        </Heading>

        <p className="font-[family-name:var(--font-body)] text-[length:var(--text-sm)] leading-relaxed text-[var(--color-text-secondary)]">
          {story.dek}
        </p>

        <p className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          By {formatStoryByline(story.byline)}
        </p>

        {story.sources && story.sources.length > 0 && (
          <p className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            Sources: {story.sources.join('; ')}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-[var(--space-4)] pt-[var(--space-3)]">
          <a href={story.url} {...linkProps} className="btn btn-primary">
            Read {arrow}
          </a>
          {story.workSlug && (
            <Link
              to={`/works/${story.workSlug}`}
              className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              How it was made {'→'}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
