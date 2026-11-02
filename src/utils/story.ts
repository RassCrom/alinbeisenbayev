import { formatMonth } from './date';

/** "2025-03" → "March 2025". Falls back to the raw value if it is not YYYY-MM. */
export const formatStoryDate = (value: string): string => formatMonth(value);

/** ["A"] → "A"; ["A","B"] → "A and B"; ["A","B","C"] → "A, B and C". */
export function formatStoryByline(byline: string[]): string {
  if (byline.length === 0) return '';
  if (byline.length === 1) return byline[0];
  return `${byline.slice(0, -1).join(', ')} and ${byline[byline.length - 1]}`;
}
