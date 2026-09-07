import { Link } from 'react-router-dom';
import type { Story } from '../../types';
import { formatStoryByline, formatStoryDate } from '../../utils/story';

export interface StoryCalloutProps {
  story: Story;
}

/**
 * The link from a case study to the piece it is about.
 *
 * It replaces the generic "View Live" button on any project that has a story,
 * because for these five that button pointed at exactly this URL — the same
 * destination, described as a deployment rather than as something to read. A
 * reader deciding whether to open a scroll narrative wants the standfirst and
 * the byline, not a verb.
 */
export default function StoryCallout({ story }: StoryCalloutProps) {
  return (
    <aside
      className="mt-[var(--space-8)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]"
      style={{ borderLeft: '3px solid var(--color-accent)' }}
    >
      <div className="flex flex-col gap-[var(--space-4)] p-[var(--space-6)]">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <span className="mono-label text-[var(--color-accent-light)]">Read the piece</span>
          <span className="meta-pill">{story.format}</span>
          <span className="meta-pill">{formatStoryDate(story.date)}</span>
        </div>

        <div>
          <h3 className="font-[family-name:var(--font-heading)] text-[length:var(--text-xl)] font-bold">
            {story.title}
          </h3>
          <p className="mt-[var(--space-2)] max-w-prose font-[family-name:var(--font-body)] text-[length:var(--text-sm)] leading-relaxed text-[var(--color-text-secondary)]">
            {story.dek}
          </p>
          <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            By {formatStoryByline(story.byline)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[var(--space-3)]">
          <a
            href={story.url}
            target={story.external ? '_blank' : undefined}
            rel={story.external ? 'noreferrer' : undefined}
            className="btn btn-primary"
          >
            Read the story {story.external ? '↗' : '→'}
          </a>
          <Link
            to="/stories"
            className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            All stories →
          </Link>
        </div>
      </div>
    </aside>
  );
}
