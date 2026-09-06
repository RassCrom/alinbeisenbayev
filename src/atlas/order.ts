import type { Project } from '../types';

/*
 * Sheet order: the order the works page lists projects in, and the order
 * keyboard focus walks the settlements. Same three tiers as WorksPage:
 * finished before in-progress, then the curated featuredOrder run, then
 * recency and title. Kept here rather than imported because WorksPage
 * keeps its comparator private.
 */

const OPEN_ENDED = new Set(['Present', 'current']);

function dateSortValue(date: string | null): number {
  if (date !== null && OPEN_ENDED.has(date)) return Number.POSITIVE_INFINITY;
  if (!date) return Number.NEGATIVE_INFINITY;
  const [year, month = '12'] = date.split('-');
  const value = Number(year) * 12 + Number(month);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

const unfinishedRank = (project: Project): number => (project.status === 'in-progress' ? 1 : 0);
const curatedRank = (project: Project): number => project.featuredOrder ?? Number.MAX_SAFE_INTEGER;

export function sheetOrder(projects: readonly Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      unfinishedRank(a) - unfinishedRank(b) ||
      curatedRank(a) - curatedRank(b) ||
      dateSortValue(b.startDate) - dateSortValue(a.startDate) ||
      dateSortValue(b.endDate) - dateSortValue(a.endDate) ||
      a.title.localeCompare(b.title),
  );
}
