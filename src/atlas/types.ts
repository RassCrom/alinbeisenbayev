import type { ProjectCategory } from '../types';

/*
 * The atlas is a fictional archipelago: one island per project category, one
 * settlement per project, sea lanes between related projects. Everything here
 * is in a unit world — x and y in 0 to 1, y growing downward like a screen —
 * and carries no pixels; the renderer decides the scale.
 */

/** Settlement tiers, largest first. `ruin` is reserved for in-progress work. */
export type Tier = 'fortress' | 'walled-town' | 'market-town' | 'hamlet' | 'ruin';

export type Biome = 'mountain' | 'conifer' | 'wetland' | 'dune' | 'volcanic' | 'meadow' | 'cliffs';

/** What config.ts says about an island, before any placement. */
export interface IslandConfig {
  /** Stable key; also the painting's file name under public/atlas/. */
  id: string;
  category: ProjectCategory;
  /** The toponym as displayed. */
  name: string;
  /** What the toponym means, for the legend and the status doc. */
  gloss: string;
  biome: Biome;
  /** Multiplier on the √count radius, for hand tuning. 1 is neutral. */
  baseSize: number;
  /**
   * Where the island sits around the centre island, in degrees
   * counter-clockwise from east with north up. Ignored for the largest
   * island, which anchors the centre.
   */
  bearing: number;
}

export interface Island {
  id: string;
  category: ProjectCategory;
  name: string;
  biome: Biome;
  /** World-space centre and radius of the island's circular footprint. */
  x: number;
  y: number;
  radius: number;
  projectCount: number;
  /** The island's highest-scoring settlement, placed at its centre unless nudged. */
  seat: string | null;
}

export interface Settlement {
  slug: string;
  title: string;
  islandId: string;
  tier: Tier;
  /** The size score, 0 to 100; see score.ts. */
  score: number;
  x: number;
  y: number;
  /** Half-width of the ground the sprite occupies, world units; used for overlap. */
  footprint: number;
  /** The archipelago capital: the top featured project, crowned. */
  isCapital: boolean;
  /** Has at least one award: flies a pennant. */
  hasPennant: boolean;
  /** True when the position came from the project's `map` override. */
  pinned: boolean;
}

export type LaneReason = 'keywords' | 'series';

export interface Lane {
  /** `${from}|${to}` with the slugs in sorted order. */
  id: string;
  from: string;
  to: string;
  reason: LaneReason;
  /** The shared keywords, or the series name. */
  shared: string[];
  /** True when the ends sit on different islands: a sea lane rather than a road. */
  crossing: boolean;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Atlas {
  seed: number;
  /** The YYYY-MM month open-ended durations were measured to. */
  asOf: string;
  islands: Island[];
  settlements: Settlement[];
  lanes: Lane[];
  /** The islands' extent, for the initial camera fit. */
  bounds: Bounds;
  /** Data problems and placements that could not avoid overlap. Empty when clean. */
  warnings: string[];
}
