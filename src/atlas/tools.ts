import type { Project } from '../types';

/*
 * Two ways to light a set of settlements from the legend, both in the
 * shape the interaction store highlights:
 *
 *   tradeGoods  every tool named in a project's `stack`, merged
 *               case-insensitively (the data has both "d3.js" and "D3.js"),
 *               with the settlements that used it;
 *   homePorts   the city each project was made in (Project.madeIn, from
 *               the city file it sits in): the personal layer of the chart,
 *               Astana to Vienna by way of Long Beach, Munich and Dresden.
 *
 * Hovering a chip lights its settlements the way a settlement hover does.
 */

export interface TradeGood {
  /** Lower-case key. */
  key: string;
  /** The spelling used most often in the data. */
  label: string;
  slugs: string[];
}

export function homePorts(projects: readonly Project[]): TradeGood[] {
  const ports = new Map<string, TradeGood>();
  for (const project of projects) {
    const city = project.madeIn?.trim();
    if (!city) continue;
    const key = city.toLowerCase();
    const port = ports.get(key) ?? { key, label: city, slugs: [] };
    port.slugs.push(project.slug);
    ports.set(key, port);
  }
  return [...ports.values()].sort((a, b) => b.slugs.length - a.slugs.length || a.label.localeCompare(b.label));
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
