import type { Project, ProjectCategory } from '../types';
import { LANE_RULES, LAYOUT, TIER_FOOTPRINT } from './config.ts';
import { ISLAND_MASKS, MASK_SIZE } from './masks.ts';
import type { Rng } from './prng.ts';
import { sizeScore, tierFor } from './score.ts';
import type { Bounds, Island, IslandConfig, Lane, Settlement } from './types.ts';

/*
 * Seeded, deterministic placement. Nothing here reads the clock or
 * Math.random: the same projects, seed and asOf month always give the same
 * archipelago. Everything is in the unit world described in types.ts.
 */

const DEG = Math.PI / 180;
/** The golden angle spreads spiral points evenly, like sunflower seeds. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/* ---- Islands ------------------------------------------------------------ */

/**
 * The largest island anchors the centre. The others sit on a ring around it
 * at their configured bearing, with seeded jitter, then get pushed apart
 * until no two overlap, then the whole group is fitted into the world.
 */
export function placeIslands(
  configs: readonly IslandConfig[],
  counts: ReadonlyMap<ProjectCategory, number>,
  rng: Rng,
): Island[] {
  const islands: Island[] = configs.map((config) => {
    const count = counts.get(config.category) ?? 0;
    const radius = LAYOUT.radiusPerSqrtProject * config.baseSize * Math.sqrt(count);
    return {
      id: config.id,
      category: config.category,
      name: config.name,
      biome: config.biome,
      x: 0.5,
      y: 0.5,
      radius: Math.max(LAYOUT.minRadius, radius),
      projectCount: count,
      seat: null,
    };
  });
  if (islands.length === 0) return islands;

  const centre = islands.reduce((best, island) => (island.radius > best.radius ? island : best));
  const bearingOf = new Map(configs.map((config) => [config.id, config.bearing]));

  // Two rng draws per island in config order, whether or not it is the
  // centre, so a change of centre never shifts the others' jitter.
  for (const island of islands) {
    const bearing = ((bearingOf.get(island.id) ?? 0) + (rng() - 0.5) * LAYOUT.bearingJitter) * DEG;
    const ring = centre.radius + island.radius + LAYOUT.ringGap + rng() * LAYOUT.ringJitter;
    if (island === centre) continue;
    island.x = centre.x + Math.cos(bearing) * ring * LAYOUT.ringStretch;
    island.y = centre.y - Math.sin(bearing) * ring;
  }

  separateIslands(islands, centre);
  fitIslands(islands);
  return islands;
}

/** Push overlapping islands apart along their centre line; the centre island stays put. */
function separateIslands(islands: Island[], centre: Island): void {
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const a = islands[i];
        const b = islands[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1e-6;
        const minimum = a.radius + b.radius + LAYOUT.islandGap;
        if (distance >= minimum) continue;
        const push = (minimum - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        if (a !== centre) {
          a.x -= ux * push;
          a.y -= uy * push;
        }
        if (b !== centre) {
          b.x += ux * push;
          b.y += uy * push;
        }
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** Scale down (never up) and centre so every island sits inside the margin. */
function fitIslands(islands: Island[]): void {
  const extent = boundsOf(islands);
  const width = extent.maxX - extent.minX;
  const height = extent.maxY - extent.minY;
  const available = 1 - 2 * LAYOUT.margin;
  const scale = Math.min(1, available / Math.max(width, height));
  const offsetX = (1 - width * scale) / 2 - extent.minX * scale;
  const offsetY = (1 - height * scale) / 2 - extent.minY * scale;
  for (const island of islands) {
    island.x = island.x * scale + offsetX;
    island.y = island.y * scale + offsetY;
    island.radius *= scale;
  }
}

export function boundsOf(islands: readonly Island[]): Bounds {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const island of islands) {
    bounds.minX = Math.min(bounds.minX, island.x - island.radius);
    bounds.maxX = Math.max(bounds.maxX, island.x + island.radius);
    bounds.minY = Math.min(bounds.minY, island.y - island.radius);
    bounds.maxY = Math.max(bounds.maxY, island.y + island.radius);
  }
  return islands.length === 0 ? { minX: 0, minY: 0, maxX: 1, maxY: 1 } : bounds;
}

/* ---- Land --------------------------------------------------------------- */

/** Half-width, in world units, of the square painting drawn for an island. */
export function paintingHalfWidth(island: Pick<Island, 'radius'>): number {
  return island.radius * LAYOUT.paintingScale;
}

/**
 * Whether a world point falls on the island's painted land, read from the
 * mask baked by scripts/prepare-atlas-assets.py. Islands without a mask are
 * treated as solid discs.
 */
export function isLand(island: Island, x: number, y: number): boolean {
  const rows = ISLAND_MASKS[island.id];
  const half = paintingHalfWidth(island);
  if (rows === undefined) return Math.hypot(x - island.x, y - island.y) <= island.radius;
  const column = Math.floor(((x - island.x) / (2 * half) + 0.5) * MASK_SIZE);
  const row = Math.floor(((y - island.y) / (2 * half) + 0.5) * MASK_SIZE);
  if (column < 0 || row < 0 || column >= MASK_SIZE || row >= MASK_SIZE) return false;
  return rows[row]?.charAt(column) === '1';
}

/**
 * Land at the point and at four points half a footprint away, so a sprite's
 * base keeps off the shoreline without demanding a whole footprint of beach.
 */
function standsOnLand(island: Island, x: number, y: number, footprint: number): boolean {
  const reach = footprint / 2;
  return (
    isLand(island, x, y) &&
    isLand(island, x + reach, y) &&
    isLand(island, x - reach, y) &&
    isLand(island, x, y + reach) &&
    isLand(island, x, y - reach)
  );
}

/* ---- Settlements -------------------------------------------------------- */

export interface SettlementOptions {
  asOf: string;
  /** Slug of the archipelago capital, or null when nothing is featured. */
  capital: string | null;
  /** This island's own stream, so one island's changes never reshuffle another. */
  rng: Rng;
}

export interface Placement {
  settlements: Settlement[];
  warnings: string[];
}

/**
 * Settlements are ranked by score. The first takes the island's centre; the
 * rest follow a golden-angle spiral outward. A slot is skipped when it is
 * off the painted land or when sprite footprints would overlap. A project's
 * `map` override wins over the spiral on the axis it sets and is exempt from
 * both tests; a pinned settlement placed earlier in rank order is still an
 * obstacle for the rest.
 */
export function placeSettlements(
  island: Island,
  projects: readonly Project[],
  options: SettlementOptions,
): Placement {
  const ranked = projects
    .map((project) => ({
      project,
      score: sizeScore(project, options.asOf),
      tier: tierFor(project, options.asOf),
    }))
    .sort((a, b) => b.score - a.score || a.project.title.localeCompare(b.project.title));

  const inner = island.radius * LAYOUT.buildable;
  // The spiral reaches the rim only after spiralDensity times as many slots
  // as there are settlements, so skipped slots still sample the interior
  // rather than piling up on the coast.
  const span = Math.max(ranked.length - 1, 1) * LAYOUT.spiralDensity;
  const theta0 = options.rng() * Math.PI * 2;
  const settlements: Settlement[] = [];
  const warnings: string[] = [];
  const overlaps = (x: number, y: number, footprint: number): boolean =>
    settlements.some((other) => Math.hypot(other.x - x, other.y - y) < footprint + other.footprint);

  let slot = 0;
  ranked.forEach((entry, rank) => {
    const footprint = TIER_FOOTPRINT[entry.tier];
    let x = island.x;
    let y = island.y;
    let settled = rank === 0 && standsOnLand(island, x, y, footprint);
    for (let tries = 0; tries < LAYOUT.maxPlacementTries && !settled; tries++) {
      slot += 1;
      const radius = inner * Math.min(1, Math.sqrt(slot / span));
      const theta = theta0 + slot * GOLDEN_ANGLE;
      x = island.x + Math.cos(theta) * radius;
      y = island.y + Math.sin(theta) * radius;
      settled = standsOnLand(island, x, y, footprint) && !overlaps(x, y, footprint);
    }
    const override = entry.project.map;
    const pinned = override?.x !== undefined || override?.y !== undefined;
    if (override?.x !== undefined) x = override.x;
    if (override?.y !== undefined) y = override.y;
    if (!settled && !pinned) {
      warnings.push(`${entry.project.slug}: no free land slot on ${island.name}, placed with overlap or in water`);
    }
    settlements.push({
      slug: entry.project.slug,
      title: entry.project.title,
      islandId: island.id,
      tier: entry.tier,
      score: entry.score,
      x,
      y,
      footprint,
      isCapital: entry.project.slug === options.capital,
      hasPennant: entry.project.awards.length > 0,
      pinned,
    });
  });
  return { settlements, warnings };
}

/** Pairs of settlements whose footprints overlap, as warning lines. */
export function overlapWarnings(settlements: readonly Settlement[]): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < settlements.length; i++) {
    for (let j = i + 1; j < settlements.length; j++) {
      const a = settlements[i];
      const b = settlements[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < a.footprint + b.footprint) {
        warnings.push(`${a.slug} and ${b.slug} overlap (${distance.toFixed(3)} apart)`);
      }
    }
  }
  return warnings;
}

/* ---- Lanes -------------------------------------------------------------- */

const normalise = (keyword: string): string => keyword.trim().toLowerCase();

/**
 * One lane per pair that shares enough keywords or a series, whichever is
 * found first; keyword lanes win the tie so `shared` lists the real overlap.
 * Pairs are visited in slug order, so the output order is stable.
 */
export function buildLanes(projects: readonly Project[], islandOf: ReadonlyMap<string, string>): Lane[] {
  const lanes = new Map<string, Lane>();
  const laneId = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const add = (a: string, b: string, reason: Lane['reason'], shared: string[]): void => {
    const id = laneId(a, b);
    if (lanes.has(id)) return;
    const [from, to] = id.split('|');
    lanes.set(id, { id, from, to, reason, shared, crossing: islandOf.get(from) !== islandOf.get(to) });
  };

  const sorted = [...projects].sort((a, b) => a.slug.localeCompare(b.slug));
  for (let i = 0; i < sorted.length; i++) {
    const keywords = new Set(sorted[i].keywords.map(normalise));
    for (let j = i + 1; j < sorted.length; j++) {
      const shared = [...new Set(sorted[j].keywords.map(normalise))].filter((k) => keywords.has(k));
      if (shared.length >= LANE_RULES.minSharedKeywords) add(sorted[i].slug, sorted[j].slug, 'keywords', shared);
    }
  }

  for (const [series, slugs] of Object.entries(LANE_RULES.series)) {
    const present = slugs.filter((slug) => islandOf.has(slug));
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) add(present[i], present[j], 'series', [series]);
    }
  }
  return [...lanes.values()];
}
