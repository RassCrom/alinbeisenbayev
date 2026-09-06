# Atlas status

The running record of the `experiment-map` branch: what exists, where, and
what was decided. Each stage prompt in `docs/prompts/` reads this first and
appends to it. Art direction: `docs/concepts/10-realistic-hover-hud.png`.

## Stage 1: foundation (done)

### Branch

`experiment-map` from `e07b094` on main. The uncommitted work that was on
main sits in `stash@{0}` ("wip: pre-experiment-map uncommitted work on
main") and must stay there; it includes `src/utils/projects.ts` and
`src/hooks/useReveal.ts`, which do not exist on this branch. Stage 3 and 6
prompts mention them; re-create what is needed or pop the stash later.

### File layout

```
src/atlas/
  types.ts     Tier, Biome, IslandConfig, Island, Settlement, Lane, Bounds, Atlas
  config.ts    ATLAS_SEED, tiers and footprints, ISLAND_BY_CATEGORY (toponyms,
               biomes, bearings), LAYOUT constants, LANE_RULES (series lists)
  score.ts     sizeScore / scoreTerms / tierFor, the weights and the comment
  prng.ts      mulberry32 and an FNV-1a string hash
  layout.ts    placeIslands, placeSettlements, buildLanes, isLand, bounds
  masks.ts     GENERATED: 48×48 land masks per island from the painting alpha
  index.ts     buildAtlas(projects, { asOf?, seed? }) and re-exports
scripts/
  print-atlas.ts           node scripts/print-atlas.ts [--as-of YYYY-MM]
                           [--svg out.svg] [--json out.json]; exits 1 on problems
  prepare-atlas-assets.py  masters in assets-src/atlas/*.png -> public/atlas/*.webp
                           and src/atlas/masks.ts (needs Pillow)
public/atlas/
  island-<id>.webp × 7, settlement-<tier>.webp × 5, crown.webp, pennant.webp,
  glow.webp, PROMPTS.md
assets-src/atlas/          the 15 PNG masters, gitignored like the video masters
```

Value imports inside `src/atlas/` use `.ts` extensions so node's native type
stripping can run the modules without a bundler; tsc allows it through
`allowImportingTsExtensions` and Vite resolves them normally. `import type`
lines are erased, so `../types` needs no extension.

`Project` gained one optional field, `map?: { x?: number; y?: number }`: an
absolute world position that overrides the seeded placement on the axis it
sets. Nothing else in the schema changed.

### World model

- Unit world: x and y in 0 to 1, y downward. `Atlas.bounds` is the islands'
  extent, for the camera to fit.
- Island radius = 0.055 × baseSize × √count, floored at 0.06, then the whole
  group is scaled down together if the ring would leave the world. Area is
  proportional to project count, so social media is large and the two
  one-project categories are islets.
- Each island's painting is a square sprite of half-width
  `paintingHalfWidth(island)` = radius × 0.92, centred on the island. The
  land mask spans that same square; `isLand(island, x, y)` reads it.
- Settlement footprints (half-width, world units): fortress 0.028, walled
  town 0.024, market town 0.02, hamlet and ruin 0.016. No two settlements sit
  closer than the sum of their footprints, and every settlement stands on
  masked land with half a footprint of land around it.

### Placement

Largest island at the centre; the others on a ring at their configured
bearing (config), jittered by the seed, stretched 1.25× horizontally, pushed
apart until 0.06 of water separates any two, then fitted with a 0.05 margin.
Within an island, settlements are ranked by score; the first takes the
centre (the island's `seat`), the rest follow a golden-angle spiral outward,
skipping slots that are off land or overlap. Each island draws from its own
seeded stream (`seed ^ hash(id)`), so adding a project to one island never
reshuffles another. Same projects, seed and `asOf` month always give the
same atlas; `scripts/print-atlas.ts` prints it and exits non-zero on
problems.

### Size score (approved)

```
score = 35·F + 30·G + 20·P + 15·D            (0 to 100)
F  featured   0.4 + 0.6·(1 − (featuredOrder − 1)/8) when featured, else 0
G  gallery    min(images + 0.5·videos, 6) / 6
P  process    min(steps, 4) / 4
D  duration   log2(1 + months) / log2(13), capped at 1
tiers: ≥ 50 fortress, ≥ 30 walled town, ≥ 15 market town, else hamlet;
in-progress is always a ruin
```

Open-ended dates are measured to `asOf` (YYYY-MM), an option of
`buildAtlas` defaulting to the current month; the print script pins
2026-09. Today's result: 3 fortresses (silk-road, astana-buildings,
tigranes-the-greatest), 4 walled towns (asharshylyq, pie-clock, gulag,
heat-stress-vienna), 5 market towns, 8 hamlets, 9 ruins. Capital: silk-road.
Pennants: the 7 projects with awards.

### Islands (approved)

| Category | Island | Gloss | Biome | Bearing |
| --- | --- | --- | --- | --- |
| social media (11) | Jailau | summer pasture | meadow | centre |
| print (5) | Tasqyr | stone ridge | mountain | −55° (lower right) |
| storytelling map (4) | Qaragai | pine | conifer | 35° (upper right) |
| interactive map (4) | Tikjar | steep cliff | sea cliffs | 215° (lower left) |
| game (3) | Qumtöbe | sand hill | dune | 145° (upper left) |
| analysis (1) | Ottas | firestone | volcanic | −10° (right) |
| platform (1) | Sazköl | marsh lake | wetland | 265° (bottom) |

Bearings are degrees counter-clockwise from east, north up. Names are
invented compounds from Kazakh roots; the western alternative set
(Fairmead, Greywatch, Thornwood, Gullcliff, Saltreach, Emberholt, Marrowfen)
was offered and not taken.

### Lanes

Two or more shared keywords (case-insensitive), or membership of a series
in `LANE_RULES.series`: fire, heat, motion, kazakh-memory, austria, games.
35 lanes today: 20 cross water (`crossing: true`, draw as sea lanes), 15
join settlements on one island (draw as roads). Five settlements have no
lane: old-map-collection, challenge-1124, chess-map, pie-clock,
mythical-animals.

### Assets

Generated with Higgsfield `nano_banana_pro` (2 credits each) with concept
06 or 07 as an image reference, cut out with `remove_background`, then
converted by `scripts/prepare-atlas-assets.py`: crop to the alpha box with a
3% margin, pad to square, resize, WebP quality 88. Prompts and the pipeline
are in `public/atlas/PROMPTS.md`. Total 2.9 MB.

| File | Pixels | Notes |
| --- | --- | --- |
| island-jailau / tasqyr / qaragai / tikjar | 2048 | large islands |
| island-qumtobe | 1536 | |
| island-ottas / sazkol | 1024 | islets |
| settlement-fortress / walled-town / market-town | 768 | three-quarter view, black ground removed |
| settlement-hamlet / ruin | 640 | |
| crown | 256 | flat gold emblem |
| pennant | 256 | crimson flag on a pole, from a 2:3 render |
| glow | 512 | RGB on black; draw additively, no alpha |

Approval: every render was shown as a contact sheet; Qaragai was
regenerated once to remove painted clouds, the glow needed one retry after
a failed job. The background remover trimmed the settlements' ground
patches, which suits compositing onto the paintings.

Sprite anchors (for stage 2): islands and glow at the centre; settlements
at about (0.5, 0.8) of the sprite, where the buildings meet the ground;
crown at bottom centre; pennant at the pole's foot, bottom left.

### Deferred

- Label collision: the schematic shows crowding on Jailau; stage 2 owns it.
- Sprite anchors above are estimates; tune in the renderer.
- `docs/cartographic-roadmap.md` and `docs/experiment-map-prompt.md` were
  untracked on main and are committed here so the branch is self-contained.
