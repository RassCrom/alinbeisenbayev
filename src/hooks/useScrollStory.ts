import { useEffect, useRef, useState } from 'react';

/**
 * Intersection Observer over story panels (About page).
 * Returns the active panel index (drives the globe) and per-panel
 * visibility flags (drives the fade-up reveal animation).
 */
export function useScrollStory(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState<boolean[]>(() => new Array(count).fill(false));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLElement).dataset.storyIndex);
          if (Number.isNaN(index)) return;
          setActiveIndex(index);
          setVisible((prev) => {
            if (prev[index]) return prev;
            const next = [...prev];
            next[index] = true;
            return next;
          });
        });
      },
      { threshold: 0.35, rootMargin: '-10% 0px -10% 0px' },
    );

    refs.current.slice(0, count).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  const setPanelRef = (index: number) => (el: HTMLElement | null) => {
    refs.current[index] = el;
  };

  return { activeIndex, visible, setPanelRef };
}
