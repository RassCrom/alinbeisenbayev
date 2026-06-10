import { useMemo, useState } from 'react';
import type { Project } from '../types';

/** Search (title, tagline, keywords, stack) + keyword pill filtering for project lists. */
export function useProjectFilter(projects: Project[], initialSearch = '') {
  const [search, setSearch] = useState(initialSearch);
  const [selected, setSelected] = useState<string[]>([]);

  const keywords = useMemo(() => {
    const all = new Set<string>();
    projects.forEach((p) => p.keywords.forEach((k) => all.add(k)));
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const toggleKeyword = (keyword: string) => {
    setSelected((prev) =>
      prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword],
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesSearch =
        q === '' ||
        p.title.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.toLowerCase().includes(q)) ||
        p.stack.some((s) => s.toLowerCase().includes(q));
      const matchesKeywords =
        selected.length === 0 || selected.some((k) => p.keywords.includes(k));
      return matchesSearch && matchesKeywords;
    });
  }, [projects, search, selected]);

  return { search, setSearch, selected, toggleKeyword, keywords, filtered };
}
