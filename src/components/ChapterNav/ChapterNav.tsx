import { useEffect, useState, type RefObject } from 'react';

interface Chapter {
  id: string;
  text: string;
}

/**
 * The chapters of a long entry, read from its own `h2[id]` headings, with the
 * one being read marked. Shown only when there are at least two: a list of
 * one chapter is a label, not navigation.
 */
export default function ChapterNav({ containerRef }: { containerRef: RefObject<HTMLElement> }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const headings = Array.from(container.querySelectorAll<HTMLElement>('h2[id]'));
    setChapters(headings.map((heading) => ({ id: heading.id, text: heading.textContent ?? '' })));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [containerRef]);

  if (chapters.length < 2) return null;

  return (
    <nav aria-labelledby="chapter-nav-title" className="chapter-nav">
      <p id="chapter-nav-title" className="t-meta">
        On this page
      </p>
      <ol>
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              className="chapter-nav__link focus-ring"
              aria-current={activeId === chapter.id ? 'location' : undefined}
            >
              {chapter.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
