/** "2025-03" → "March 2025". Falls back to the raw value if it is not YYYY-MM. */
export function formatStoryDate(value: string): string {
  const [year, month] = value.split('-');
  if (!month) return year ?? value;
  const date = new Date(Number(year), Number(month) - 1);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** ["A"] → "A"; ["A","B"] → "A and B"; ["A","B","C"] → "A, B and C". */
export function formatStoryByline(byline: string[]): string {
  if (byline.length === 0) return '';
  if (byline.length === 1) return byline[0];
  return `${byline.slice(0, -1).join(', ')} and ${byline[byline.length - 1]}`;
}
