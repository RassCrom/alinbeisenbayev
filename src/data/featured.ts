import type { Project } from '../types';

/**
 * The featured works in their editorial running order: `featuredOrder`
 * ascending, with any featured work that has no order at the end.
 *
 * Array order alone means nothing here; `projects` is merged in alphabetical
 * city-file order.
 */
export function featuredWorks(list: Project[]): Project[] {
  return list
    .filter((project) => project.featured)
    .sort(
      (a, b) =>
        (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER),
    );
}
