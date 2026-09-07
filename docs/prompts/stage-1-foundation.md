# Stage 1 of 7: foundation, plan, data layer, assets

## Project context

This is a React 18 + Vite + Tailwind 4 + TypeScript portfolio for a
cartographer. Routes live in `src/App.tsx`: `/` (LandingPage), `/works`,
`/works/:slug`, `/about`, `/skills`, `/connect`, `/blog`, `/blog/:slug`.
Projects are JSON files under `src/data/projects/*.json`, merged in
`src/data/projects.ts`; the `Project` type is in `src/types/`. There are 29
projects in 7 categories: social media (11), print (5), interactive map (4),
storytelling map (4), game (3), analysis (1), platform (1). Fields that matter
here: `slug`, `title`, `category`, `status` (`complete` or `in-progress`),
`featuredOrder`, `startDate`, `endDate`, `gallery`, `process`, `awards`,
`keywords`, `stack`, `coverImage`.

Existing pieces to reuse later, do not modify now: `WorkCard`, `LocatorInset`,
the cover-to-hero morph between the works grid and `WorkDetailPage`, the
`CustomCursor`, `useReveal` scroll-reveal wrappers, the dark and light theme
built on `-rgb` triplet tokens in `src/styles/global.css`. The existing
`WorksMap` component is a real-world map and stays untouched.

## The feature

A new default view at `/`: a fictional archipelago rendered as a realistic
strategy-game map in a dark cinematic grade. Each category is an island,
each project is a settlement, weather comes live from Astana, and the visitor
pans, zooms, hovers and clicks through to projects. A button toggles back to
the existing landing page. Art direction is
`docs/concepts/10-realistic-hover-hud.png`; supporting references are `06`
(composition), `07` (settlement tiers), `08` and `09` (weather), `11` (night).
Ignore concepts `01` to `05`.

## This stage

### 1. Branch

Stash the uncommitted changes and leave them stashed. Create
`experiment-map` from the current commit. `docs/concepts/` and
`docs/prompts/` are untracked; commit them on the branch.

### 2. Plan for approval

Before writing code, present and wait for approval on:

- the size score formula: a pure function mapping a project to one of five
  tiers (fortress, walled town, market town, hamlet, ruin) from gallery
  length, process step count, duration, `featuredOrder` and status.
  In-progress projects are always ruins;
- the category-to-biome assignment (mountain, conifer forest, wetland, dune,
  volcanic, meadow, sea cliffs), one biome per category;
- seven invented island toponyms;
- the file layout below, or a better one with reasons.

### 3. Data layer

Create `src/atlas/` with:

- `config.ts`: categories to islands (name, biome, base size), seed value,
  tier names, lane rules;
- `score.ts`: the approved size score, with a comment explaining the weights;
- `layout.ts`: seeded deterministic placement. Island area scales with
  project count on a square-root scale. Settlements are placed inside their
  island without overlap, capital nearest the centre. Sea lanes connect
  projects that share a series or two or more keywords. Same input must
  always give the same output;
- `types.ts`: Island, Settlement, Lane, Tier;
- `index.ts`: one `buildAtlas(projects)` export returning islands,
  settlements and lanes in a 0 to 1 world coordinate space.

Add an optional `map?: { x?: number; y?: number }` override to the `Project`
type for hand nudges. Do not change anything else in the schema.

Write a small dev-only check, in the style of the existing one in
`src/data/projects.ts`, that fails loudly if a category has no island config.

### 4. Assets

Use the Higgsfield MCP to generate and save under `public/atlas/`:

- seven island paintings from concept `06`, one per biome, each on a
  transparent background (use the remove-background tool), top-down,
  consistent lighting from the upper right, dark cinematic grade, no
  settlements painted in;
- five settlement sprites from concept `07`: fortress, walled town, market
  town, hamlet, ruin, transparent background, same lighting;
- one amber window-glow sprite, one crown sprite, one pennant sprite.

Show every asset for approval before saving. Record the generation prompts
in `public/atlas/PROMPTS.md` so they can be regenerated.

## Constraints

- tsc and the production build stay clean.
- No new runtime dependencies in this stage.
- Do not render anything yet; this stage is data and assets only.

## Done when

- `buildAtlas(projects)` returns a stable layout, covered by a small test or
  a dev script that prints it;
- all assets are approved and in `public/atlas/`;
- `docs/atlas-status.md` exists describing the file layout, the approved
  score formula, biome map, toponyms, asset list, and anything deferred;
- everything is committed on `experiment-map`.
