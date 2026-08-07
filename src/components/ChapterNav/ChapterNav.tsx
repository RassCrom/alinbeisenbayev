import { useEffect, useState, type RefObject } from 'react';

interface Chapter {
  id: string;
  text: string;
}

export default function ChapterNav({ containerRef }: { containerRef: RefObject<HTMLElement> }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const headings = Array.from(container.querySelectorAll<HTMLElement>('h2[id]'));
    setChapters(headings.map((h) => ({ id: h.id, text: h.textContent ?? '' })));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [containerRef]);

  if (chapters.length < 2) return null;

  return (
    <nav
      aria-label="Chapters"
      className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-[var(--space-6)] py-[var(--space-5)]"
    >
      <p className="mono-label">On this page</p>
      <ol className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
        {chapters.map((chapter, i) => (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              className={`flex gap-[var(--space-3)] font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] transition-colors hover:text-[var(--color-accent-light)] ${
                activeId === chapter.id ? 'text-[var(--color-accent-light)]' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <span className="text-[var(--color-text-muted)]">{String(i + 1).padStart(2, '0')}</span>
              {chapter.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
