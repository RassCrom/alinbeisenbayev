import type { Project } from '../types';
import type { Tier } from './types.ts';

/*
 * The size score, 0 to 100, decides which sprite a project gets.
 *
 * Weights, and why:
 *
 *   featured  35  the curated `featuredOrder` is the only editorial signal in
 *                 the data, so it carries the most. Being featured at all is
 *                 worth a floor of 14 points (0.4 × 35); rank 1 is worth the
 *                 full 35, and each rank below it gives up a further eighth
 *                 of the remaining 21.
 *   gallery   30  how much there is to look at. Images count 1, videos 0.5:
 *                 the animation projects have no stills and would otherwise
 *                 score nothing here. Six items saturate.
 *   process   20  a documented process is what turns a map into a case
 *                 study. Four steps saturate.
 *   duration  15  log scale, so a year saturates but one month is still
 *                 worth 4 points: long-running work reads bigger without the
 *                 calendar outweighing the curated signal.
 *
 * Thresholds are fixed rather than quantiles, so adding a project never
 * re-tiers the others: 50 and up is a fortress, 30 a walled town, 15 a market
 * town, anything below a hamlet. In-progress work is always a ruin, whatever
 * its score; the chronicle stage grows it through the tiers once finished.
 *
 * Open-ended dates ("Present") are measured to `asOf` (YYYY-MM), passed in
 * rather than read from the clock, so the function is pure and the dev
 * script prints the same layout tomorrow.
 */

export const SCORE_WEIGHTS = { featured: 35, gallery: 30, process: 20, duration: 15 } as const;

/** Featured ranks 1 to 8 spread across the top 60% of the featured weight. */
const FEATURED_RANKS = 8;
const FEATURED_FLOOR = 0.4;
const GALLERY_CAP = 6;
const VIDEO_WEIGHT = 0.5;
const PROCESS_CAP = 4;
/** Months at which the duration term saturates. */
const DURATION_CAP = 12;

export const TIER_THRESHOLDS: readonly { tier: Exclude<Tier, 'ruin'>; min: number }[] = [
  { tier: 'fortress', min: 50 },
  { tier: 'walled-town', min: 30 },
  { tier: 'market-town', min: 15 },
  { tier: 'hamlet', min: 0 },
];

/* ---- Dates -------------------------------------------------------------- */

/** Sentinels the data uses for an unfinished end date. */
const OPEN_ENDED = new Set(['Present', 'current']);
const DATE = /^(\d{4})(?:-(\d{2}))?$/;

/**
 * Months since year 0 for a `YYYY` or `YYYY-MM` string. A bare year counts
 * from January when it starts a range and to December when it ends one.
 * Open-ended and missing end dates resolve to `asOf`. Null for anything else.
 */
function monthIndex(date: string | null, edge: 'start' | 'end', asOf: string): number | null {
  const value = date === null || OPEN_ENDED.has(date) ? (edge === 'end' ? asOf : null) : date;
  if (value === null) return null;
  const match = DATE.exec(value);
  if (!match) return null;
  const month = match[2] ? Number(match[2]) : edge === 'start' ? 1 : 12;
  return Number(match[1]) * 12 + month;
}

/** Inclusive length of the project in months; at least 1 when both ends parse, else 0. */
export function durationMonths(project: Pick<Project, 'startDate' | 'endDate'>, asOf: string): number {
  const start = monthIndex(project.startDate, 'start', asOf);
  const end = monthIndex(project.endDate, 'end', asOf);
  if (start === null || end === null) return 0;
  return Math.max(1, end - start + 1);
}

/* ---- Score -------------------------------------------------------------- */

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface ScoreTerms {
  featured: number;
  gallery: number;
  process: number;
  duration: number;
  total: number;
}

/** Each term in 0 to 1, and the weighted total in 0 to 100. */
export function scoreTerms(project: Project, asOf: string): ScoreTerms {
  const rank = project.featured ? project.featuredOrder : undefined;
  const featured =
    rank === undefined ? 0 : FEATURED_FLOOR + (1 - FEATURED_FLOOR) * clamp01(1 - (rank - 1) / FEATURED_RANKS);
  const items = project.gallery.length + VIDEO_WEIGHT * (project.videos?.length ?? 0);
  const gallery = Math.min(items, GALLERY_CAP) / GALLERY_CAP;
  const process = Math.min(project.process.length, PROCESS_CAP) / PROCESS_CAP;
  const duration = Math.min(Math.log2(1 + durationMonths(project, asOf)) / Math.log2(1 + DURATION_CAP), 1);
  const total =
    SCORE_WEIGHTS.featured * featured +
    SCORE_WEIGHTS.gallery * gallery +
    SCORE_WEIGHTS.process * process +
    SCORE_WEIGHTS.duration * duration;
  return { featured, gallery, process, duration, total };
}

export function sizeScore(project: Project, asOf: string): number {
  return scoreTerms(project, asOf).total;
}

export function tierFromScore(score: number): Exclude<Tier, 'ruin'> {
  return (TIER_THRESHOLDS.find((t) => score >= t.min) ?? TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1]).tier;
}

export function tierFor(project: Project, asOf: string): Tier {
  return project.status === 'in-progress' ? 'ruin' : tierFromScore(sizeScore(project, asOf));
}
