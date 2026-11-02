/** The spelling the project data uses for "still going". */
export const ONGOING = 'Present';

/**
 * "2025-03" → "March 2025" (or "Mar 2025" with `month: 'short'`), "2024" →
 * "2024", "Present" → "present". Anything else comes back unchanged.
 */
export function formatMonth(value: string, month: 'long' | 'short' = 'long'): string {
  if (value === ONGOING) return 'present';
  const [year, monthPart] = value.split('-');
  if (!monthPart) return year ?? value;
  const date = new Date(Number(year), Number(monthPart) - 1);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { month, year: 'numeric' });
}

/**
 * "2026-08-01" → "1 August 2026". Read and printed in UTC: `new Date` parses a
 * bare ISO date as UTC midnight, so a local-time format would show the day
 * before to every visitor west of Greenwich.
 */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** The year a project ended, or null while it is ongoing or undated. */
export function projectYear(endDate: string | null): number | null {
  if (!endDate) return null;
  return Number(endDate.slice(0, 4)) || null;
}
