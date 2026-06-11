import { useMemo, useState } from 'react';
import blogData from '../data/blog.json';
import type { BlogData, BlogPost } from '../types';

const { feeds } = blogData as BlogData;

type FeedKey = keyof BlogData['feeds'];

const TABS: { id: 'all' | FeedKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'telegram', label: 'Telegram' },
];

function youTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return match ? match[1] : null;
}

function PostCard({ post }: { post: BlogPost }) {
  const videoId = post.platform === 'youtube' && post.videoUrl ? youTubeId(post.videoUrl) : null;
  const excerpt = post.text ?? post.description ?? '';

  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      {videoId ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={post.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full border-0"
        />
      ) : post.previewImage ? (
        <img
          src={post.previewImage}
          alt={post.title}
          width={1200}
          height={630}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full object-cover"
        />
      ) : (
        /* Telegram posts without an image — show a subtle placeholder */
        <div className="flex aspect-video w-full items-center justify-center bg-[var(--color-bg-elevated)]">
          <img src="/images/socials/telegram.svg" alt="Telegram" width={40} height={40} className="opacity-20" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-[var(--space-3)] p-[var(--space-6)]">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <span className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-full)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-[var(--space-3)] py-[var(--space-1)]">
            <img src={`/images/socials/${post.platform}.svg`} alt={post.platform} width={14} height={14} />
            <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
              {post.account}
            </span>
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            {post.type}
          </span>
        </div>
        <h3 className="font-[family-name:var(--font-heading)] text-[length:var(--text-xl)] font-bold">
          {post.title}
        </h3>
        {excerpt && (
          <p className="clamp-3 font-[family-name:var(--font-body)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
            {excerpt}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-[var(--space-3)]">
          <time className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            {post.date}
          </time>
          <a href={post.url} target="_blank" rel="noreferrer" className="btn btn-secondary">
            View ↗
          </a>
        </div>
      </div>
    </article>
  );
}

export default function BlogPage() {
  const [tab, setTab] = useState<'all' | FeedKey>('all');
  const [search, setSearch] = useState('');

  const posts = useMemo(() => {
    const list: BlogPost[] =
      tab === 'all' ? Object.values(feeds).flat() : [...feeds[tab]];
    const q = search.trim().toLowerCase();
    const matching = q
      ? list.filter((post) =>
          [post.title, post.text ?? '', post.description ?? '', post.account]
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : list;
    return matching.sort((a, b) => b.date.localeCompare(a.date));
  }, [tab, search]);

  return (
    <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-12)]">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
        Blog
      </h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search posts…"
        aria-label="Search posts"
        className="mt-[var(--space-6)] w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-[var(--space-4)] py-[var(--space-3)] font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
      />

      <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`pill cursor-pointer hover:border-[var(--color-accent)] ${tab === t.id ? 'pill-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {posts.length > 0 ? (
        <div className="mt-[var(--space-8)] grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="py-[var(--space-16)] text-center text-[var(--color-text-muted)]">
          {search.trim() ? 'No posts match your search.' : 'No posts yet.'}
        </p>
      )}
    </div>
  );
}
