import type { Project } from '../types';

/*
 * Stack as trade goods: every tool named in a project's `stack`, merged
 * case-insensitively (the data has both "d3.js" and "D3.js"), with the
 * settlements that used it. The legend lists them; hovering one lights its
 * settlements the way a settlement hover does.
 */

export interface TradeGood {
  /** Lower-case key. */
  key: string;
  /** The spelling used most often in the data. */
  label: string;
  slugs: string[];
}

export function tradeGoods(projects: readonly Project[]): TradeGood[] {
  const goods = new Map<string, { spellings: Map<string, number>; slugs: Set<string> }>();
  for (const project of projects) {
    for (const raw of project.stack) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const entry = goods.get(key) ?? { spellings: new Map(), slugs: new Set() };
      entry.spellings.set(label, (entry.spellings.get(label) ?? 0) + 1);
      entry.slugs.add(project.slug);
      goods.set(key, entry);
    }
  }
  return [...goods.entries()]
    .map(([key, entry]) => ({
      key,
      label: [...entry.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      slugs: [...entry.slugs],
    }))
    .sort((a, b) => b.slugs.length - a.slugs.length || a.label.localeCompare(b.label));
}
