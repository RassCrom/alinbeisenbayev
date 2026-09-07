import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StoryCard from '../components/StoryCard/StoryCard';
import { STORY_FORMATS, stories } from '../data/stories';
import { usePageMeta } from '../hooks/usePageMeta';
import type { StoryFormat } from '../types';

type FilterId = 'all' | StoryFormat;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  ...STORY_FORMATS.map((format) => ({ id: format as FilterId, label: format })),
];

export default function StoriesPage() {
  usePageMeta(
    'Stories',
    'Scroll-driven map narratives, reports and map essays on history, climate and Central Asia.',
  );
  const [filter, setFilter] = useState<FilterId>('all');

  const visible = useMemo(
    () => (filter === 'all' ? stories : stories.filter((story) => story.format === filter)),
    [filter],
  );

  /*
   * Only the unfiltered front page gets a lead story. Inside a filter the set is
   * small and homogeneous, so promoting its first item would just make one
   * arbitrary card twice the size of its neighbour.
   */
  const lead = filter === 'all' ? visible[0] : undefined;
  const rest = lead ? visible.slice(1) : visible;

  return (
    <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-12)]">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
        Stories
      </h1>
      <p className="mt-[var(--space-4)] max-w-2xl font-[family-name:var(--font-body)] text-[length:var(--text-lg)] leading-relaxed text-[var(--color-text-secondary)]">
        Published pieces — scroll-driven map narratives, reports and map essays. Read them for the
        subject; the{' '}
        <Link to="/works" className="text-[var(--color-accent-light)] hover:underline">
          work pages
        </Link>{' '}
        cover how each one was made, and the{' '}
        <Link to="/blog" className="text-[var(--color-accent-light)] hover:underline">
          blog
        </Link>{' '}
        covers the methods behind them.
      </p>

      <div className="mt-[var(--space-8)] flex flex-wrap gap-[var(--space-2)]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`pill cursor-pointer hover:border-[var(--color-accent)] ${
              filter === f.id ? 'pill-active' : ''
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-[var(--space-16)] text-center text-[var(--color-text-muted)]">
          Nothing published in this format yet.
        </p>
      ) : (
        <>
          {lead && (
            <div className="mt-[var(--space-8)]">
              <StoryCard story={lead} lead />
            </div>
          )}
          {rest.length > 0 && (
            <div className="mt-[var(--space-6)] grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2">
              {rest.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Every piece here is on someone else's domain. Saying so is more honest
          than an arrow on a button, and it explains the arrows. */}
      <p className="mt-[var(--space-16)] border-t border-[var(--color-border-subtle)] pt-[var(--space-6)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] leading-relaxed text-[var(--color-text-muted)]">
        Older pieces are hosted on their own domains and open in a new tab. New work is published
        here.
      </p>
    </div>
  );
}
