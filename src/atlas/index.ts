import type { Project, ProjectCategory } from '../types';
import { ATLAS_SEED, ISLAND_BY_CATEGORY, ISLANDS, LANE_RULES } from './config.ts';
import { boundsOf, buildLanes, overlapWarnings, placeIslands, placeSettlements } from './layout.ts';
import { hashString, mulberry32 } from './prng.ts';
import type { Atlas, Settlement } from './types.ts';

export type { Atlas, Biome, Bounds, Island, IslandConfig, Lane, LaneReason, Settlement, Tier } from './types.ts';
export { ATLAS_SEED, ISLANDS, ISLAND_BY_CATEGORY, LANE_RULES, LAYOUT, TIERS, TIER_FOOTPRINT, TIER_LABEL } from './config.ts';
export { durationMonths, scoreTerms, sizeScore, tierFor, tierFromScore, SCORE_WEIGHTS, TIER_THRESHOLDS } from './score.ts';
export { isLand, paintingHalfWidth } from './layout.ts';
export { ISLAND_MASKS, MASK_SIZE } from './masks.ts';

export interface BuildOptions {
  /** YYYY-MM month that open-ended durations are measured to. Defaults to this month. */
  asOf?: string;
  /** Overrides config's ATLAS_SEED, for previews. */
  seed?: number;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** The top featured project wears the crown; ties on order go to the first slug. */
function capitalOf(projects: readonly Project[]): string | null {
  let capital: Project | null = null;
  for (const project of projects) {
    if (!project.featured || project.featuredOrder === undefined) continue;
    if (
      capital === null ||
      project.featuredOrder < (capital.featuredOrder as number) ||
      (project.featuredOrder === capital.featuredOrder && project.slug < capital.slug)
    ) {
      capital = project;
    }
  }
  return capital?.slug ?? null;
}

/*
 * TypeScript already refuses a ProjectCategory without an island, because
 * ISLAND_BY_CATEGORY is a Record over the union. What it cannot see is the
 * JSON: a category value that drifted outside the union, or a series slug
 * that was renamed. Those surface here, in the style of the check in
 * src/data/projects.ts: dev only in the app, always in scripts/print-atlas.ts.
 */
export function atlasDataProblems(projects: readonly Project[]): string[] {
  const problems: string[] = [];
  const orphans = new Map<string, string[]>();
  for (const project of projects) {
    if (!(project.category in ISLAND_BY_CATEGORY)) {
      orphans.set(project.category, [...(orphans.get(project.category) ?? []), project.slug]);
    }
  }
  for (const [category, slugs] of orphans) {
    problems.push(`category ${JSON.stringify(category)} has no island in src/atlas/config.ts (${slugs.join(', ')})`);
  }
  const known = new Set(projects.map((project) => project.slug));
  for (const [series, slugs] of Object.entries(LANE_RULES.series)) {
    for (const slug of slugs) {
      if (!known.has(slug)) problems.push(`series ${JSON.stringify(series)} names an unknown slug ${JSON.stringify(slug)}`);
    }
  }
  return problems;
}

/**
 * The whole archipelago from the project list: islands, settlements and
 * lanes in the unit world. Pure and deterministic for a given `projects`,
 * `seed` and `asOf`; call it once and keep the result.
 */
export function buildAtlas(projects: readonly Project[], options: BuildOptions = {}): Atlas {
  const asOf = options.asOf ?? currentMonth();
  const seed = options.seed ?? ATLAS_SEED;
  const rng = mulberry32(seed);

  const counts = new Map<ProjectCategory, number>();
  for (const project of projects) counts.set(project.category, (counts.get(project.category) ?? 0) + 1);

  const islands = placeIslands(ISLANDS, counts, rng);
  const capital = capitalOf(projects);

  const settlements: Settlement[] = [];
  const placementWarnings: string[] = [];
  for (const island of islands) {
    const own = projects.filter((project) => project.category === island.category);
    const placed = placeSettlements(island, own, {
      asOf,
      capital,
      rng: mulberry32(seed ^ hashString(island.id)),
    });
    island.seat = placed.settlements[0]?.slug ?? null;
    settlements.push(...placed.settlements);
    placementWarnings.push(...placed.warnings);
  }
  // Back to input order, so callers iterating settlements see the sheet order they passed in.
  const order = new Map(projects.map((project, index) => [project.slug, index]));
  settlements.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));

  const islandOf = new Map(settlements.map((settlement) => [settlement.slug, settlement.islandId]));
  const lanes = buildLanes(projects, islandOf);
  const warnings = [...atlasDataProblems(projects), ...placementWarnings, ...overlapWarnings(settlements)];

  if (import.meta.env?.DEV && warnings.length > 0) {
    console.error(`[atlas] ${warnings.length} problem(s):\n  ${warnings.join('\n  ')}`);
  }

  return { seed, asOf, islands, settlements, lanes, bounds: boundsOf(islands), warnings };
}
