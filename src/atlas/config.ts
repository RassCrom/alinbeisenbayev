import type { ProjectCategory } from '../types';
import type { IslandConfig, Tier } from './types.ts';

/*
 * Everything hand-authored about the archipelago lives here: which category
 * is which island, the island names, the tier names, and the rules that
 * draw sea lanes. The layout and score modules only read from this file.
 *
 * Value imports inside src/atlas/ carry a `.ts` extension so that
 * scripts/print-atlas.ts can run this module directly under node's native
 * type stripping, with no bundler and no dependency. tsc allows it through
 * `allowImportingTsExtensions`, and Vite resolves it as usual.
 */

/** Changing the seed re-rolls every jitter in the layout. */
export const ATLAS_SEED = 20260906;

export const TIERS: readonly Tier[] = ['fortress', 'walled-town', 'market-town', 'hamlet', 'ruin'];

/*
 * What a tier means to a visitor. The sprite keys stay the game words
 * (fortress, walled town...) because the assets are named after them; the
 * words a visitor reads say what the size stands for: how much of the
 * project there is to see. "Ruin" was the sprite for work in progress and
 * read as abandoned; the label now says what it is.
 */
export const TIER_LABEL: Record<Tier, string> = {
  fortress: 'Landmark',
  'walled-town': 'Major',
  'market-town': 'Mid-size',
  hamlet: 'Small',
  ruin: 'In progress',
};

/** One line per tier for the legend and the explainer. */
export const TIER_BLURB: Record<Tier, string> = {
  fortress: 'the flagship works: featured, documented, with a full gallery',
  'walled-town': 'substantial: process notes and a gallery',
  'market-town': 'a finished piece with a few images',
  hamlet: 'a quick or early piece',
  ruin: 'still being built; it grows on the timeline as it finishes',
};

/**
 * Half-width of the ground each tier's sprite occupies, in world units. Two
 * settlements never sit closer than the sum of their footprints.
 */
export const TIER_FOOTPRINT: Record<Tier, number> = {
  fortress: 0.028,
  'walled-town': 0.024,
  'market-town': 0.02,
  hamlet: 0.016,
  ruin: 0.016,
};

/*
 * Category to island. Each island carries two names: the one on the map,
 * plain English built from the category and the landform, so a first-time
 * visitor reads "Print Ridge" and knows what stands there; and the native
 * name, an invented compound from Kazakh roots with its gloss, kept for the
 * legend and the island card as the personal layer of the chart. The `id`
 * is the painting's file name under public/atlas/ and never changes.
 *
 * Typed as a Record over ProjectCategory on purpose: add a category to the
 * union in src/types and tsc refuses to build until it has an island. The
 * runtime check in index.ts covers the other direction, a JSON value that
 * drifted outside the union.
 */
export const ISLAND_BY_CATEGORY: Record<ProjectCategory, Omit<IslandConfig, 'category'>> = {
  // The broad lowland that holds most of the settlements, like the centre
  // island of concept 06. Largest by count, so it anchors the composition.
  'social media': { id: 'jailau', name: 'Social Meadows', nativeName: 'Jailau', gloss: 'summer pasture', biome: 'meadow', baseSize: 1, bearing: 0 },
  // The old monumental craft: snow peaks, and the capital on top.
  print: { id: 'tasqyr', name: 'Print Ridge', nativeName: 'Tasqyr', gloss: 'stone ridge', biome: 'mountain', baseSize: 1, bearing: -55 },
  // A story is a path through the woods.
  'storytelling map': { id: 'qaragai', name: 'Story Woods', nativeName: 'Qaragai', gloss: 'pine', biome: 'conifer', baseSize: 1, bearing: 35 },
  // Web maps face outward: harbours, lighthouses, cliffs.
  'interactive map': { id: 'tikjar', name: 'Interactive Cape', nativeName: 'Tikjar', gloss: 'steep cliff', biome: 'cliffs', baseSize: 1, bearing: 215 },
  // The playful desert island of concept 06.
  game: { id: 'qumtobe', name: 'Game Dunes', nativeName: 'Qumtöbe', gloss: 'sand hill', biome: 'dune', baseSize: 1, bearing: 145 },
  // The one analysis is about ignition points; it gets the volcano.
  analysis: { id: 'ottas', name: 'Analysis Rock', nativeName: 'Ottas', gloss: 'firestone', biome: 'volcanic', baseSize: 1, bearing: -10 },
  // An environment platform gets the marsh islet.
  platform: { id: 'sazkol', name: 'Platform Marsh', nativeName: 'Sazköl', gloss: 'marsh lake', biome: 'wetland', baseSize: 1, bearing: 265 },
};

/** The same islands as an ordered list; object key order is insertion order. */
export const ISLANDS: readonly IslandConfig[] = (
  Object.entries(ISLAND_BY_CATEGORY) as [ProjectCategory, Omit<IslandConfig, 'category'>][]
).map(([category, spec]) => ({ ...spec, category }));

/**
 * The kind of work an island holds, in the visitor's words, with the
 * count: "11 social media maps", "1 analysis". Used under the island name
 * on the map and in the legend.
 */
const CATEGORY_NOUN: Record<ProjectCategory, { one: string; many: string }> = {
  'social media': { one: 'social media map', many: 'social media maps' },
  print: { one: 'printed map', many: 'printed maps' },
  'storytelling map': { one: 'story map', many: 'story maps' },
  'interactive map': { one: 'interactive map', many: 'interactive maps' },
  game: { one: 'map game', many: 'map games' },
  analysis: { one: 'analysis', many: 'analyses' },
  platform: { one: 'platform', many: 'platforms' },
};

export function describeCategory(category: ProjectCategory, count: number): string {
  const noun = CATEGORY_NOUN[category];
  return `${count} ${count === 1 ? noun.one : noun.many}`;
}

export const LAYOUT = {
  /**
   * Island radius = radiusPerSqrtProject × baseSize × √count, so area is
   * proportional to project count: the eleven-project island is large, the
   * one-project islands are islets. Nominal: the fit step may scale all
   * radii down together so the ring stays inside the world.
   */
  radiusPerSqrtProject: 0.055,
  /** No island smaller than this, so an islet still reads as land. */
  minRadius: 0.06,
  /** Water between the centre island and the ring, plus a seeded extra. */
  ringGap: 0.06,
  ringJitter: 0.03,
  /** Seeded wobble on each island's bearing, degrees. */
  bearingJitter: 16,
  /** The ring is stretched horizontally so the archipelago reads landscape. */
  ringStretch: 1.25,
  /** Minimum water between any two islands after separation. */
  islandGap: 0.06,
  /** Margin kept from the world edge when fitting. */
  margin: 0.05,
  /**
   * Half-width of an island's square painting as a fraction of its radius.
   * Below 1 so the painting's corners, where an irregular coast can reach,
   * stay inside the circle the separation step keeps clear.
   */
  paintingScale: 0.92,
  /** Fraction of the island radius the settlement spiral may reach; the land mask does the rest. */
  buildable: 0.8,
  /** Spiral slots per settlement before the spiral reaches the buildable rim. */
  spiralDensity: 6,
  /** Spiral slots tried before a settlement is placed with overlap and a warning raised. */
  maxPlacementTries: 400,
} as const;

/*
 * Sea lanes join two projects that share `minSharedKeywords` keywords, or
 * that sit in the same series. The data has no series field, so the series
 * are named here as slug lists; every pair within a series gets a lane.
 */
export const LANE_RULES = {
  minSharedKeywords: 2,
  series: {
    // The wildfire strand: FIRMS, MODIS and VIIRS work, from analysis to platform.
    fire: ['ignition-point-analysis', 'ignisatlas', 'earth-on-fire', 'europe-ignition'],
    // European summer heat.
    heat: ['heat-stress-vienna', 'tropical-night', 'heat-mortality'],
    // The animated maps.
    motion: ['coral-city-roads', 'metro-animation', 'football-mapped'],
    // Kazakh memory: famine, Alash, the notable, the camps.
    'kazakh-memory': ['asharshylyq', 'alash-orda', 'notable-kazakhs', 'gulag'],
    // Vienna and Austria, the current home.
    austria: ['heat-stress-vienna', 'historical-vienna', 'austria-income'],
    // The games.
    games: ['maple', 'figura-game', 'mythical-animals'],
  } as Record<string, readonly string[]>,
};
