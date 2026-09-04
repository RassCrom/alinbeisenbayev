import { useMemo, useState } from 'react';
import type { Project } from '../types';

/** Search (title, tagline, keywords, stack) + keyword pill filtering for project lists. */
export function useProjectFilter(projects: Project[], initialSearch = '') {
  const [search, setSearch] = useState(initialSearch);
  const [selected, setSelected] = useState<string[]>([]);

  /*
   * Only keywords that actually partition the set are offered as filters.
   *
   * The raw vocabulary is ~75 tags, 58 of which match exactly one project — a
   * tag that selects one item is a label, not a filter, and alphabetical order
   * meant the control opened on "3D, Akmola, Alash Orda". Ranking by reach puts
   * the tags that do real work first; search still matches every keyword,
   * including the singletons.
   */
  const keywords = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((p) => p.keywords.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1)));
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([keyword]) => keyword);
  }, [projects]);

  const toggleKeyword = (keyword: string) => {
    setSelected((prev) =>
      prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword],
    );
  };

  /*
   * `projects` narrows when the caller switches type tab, which can drop a
   * keyword out of the offered set while it's still selected. Filtering by a
   * pill the user can no longer see — or click again to clear — would strand
   * them on an empty grid, so a selection only counts while it's still offered.
   */
  const activeSelection = useMemo(
    () => selected.filter((k) => keywords.includes(k)),
    [selected, keywords],
  );

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
        activeSelection.length === 0 || activeSelection.some((k) => p.keywords.includes(k));
      return matchesSearch && matchesKeywords;
    });
  }, [projects, search, activeSelection]);

  return { search, setSearch, selected: activeSelection, toggleKeyword, keywords, filtered };
}
