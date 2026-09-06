# Build prompt: experiment-map

## Setup

Create a branch `experiment-map` from the current commit. Stash the
uncommitted changes first and leave them stashed; this branch must not carry
them. Keep `docs/concepts/` and this file untracked or commit them on the
branch, but do not let the stash sweep them away.

## Goal

An "atlas view" that becomes the default view at `/`. It is a fictional
archipelago rendered as a realistic strategy-game map in a dark cinematic
grade, living under the real weather of Astana. Each project category is an
island, each project is a settlement, and the whole thing is pannable,
zoomable and animated. A button switches to the current landing page and
back.

## Art direction

The north star is `docs/concepts/10-realistic-hover-hud.png`. Match it: painted
photoreal terrain, deep navy sea with foam at the coast, amber window glow,
thin gold selection ring and glowing gold ferry lanes, floating serif capital
labels, dark glass tooltip card with a cover image, one-line description and
tag pills, and a minimal bottom-left HUD with compass, weather readout and
minimap.

Supporting references: `06` for the overall composition, `07` for the five
settlement tiers and label hierarchy, `08` and `09` for blizzard and summer
sun weather, `11` for the night look. Ignore the ink-on-parchment set `01` to
`05`.

Palette: deep navy sea, painted terrain, amber window glow, thin gold lines
for selection and lanes, dark glass panels with bone text. The map view is
dark-only by design and must not break the existing theme system elsewhere.

## Data model

- 7 categories become 7 islands. Island area scales with project count, so
  social media is the large island and analysis and platform are small rocky
  islets. Each island has a biome: mountain, conifer forest, wetland, dune,
  volcanic, meadow, sea cliffs. Assign biomes to categories in one config
  file with a comment.
- Each project is a settlement in one of five tiers: fortress, walled town,
  market town, hamlet, ruin. The tier comes from a size score built from
  gallery length, process step count, duration, `featuredOrder` and status.
  In-progress projects are always ruins. Put the score in one pure function
  with a comment explaining the weights.
- The top featured project is the capital and wears a crown above its label,
  as in concept 10.
- Projects with entries in `awards` fly a pennant on their walls.
- Sea lanes connect projects that share a series or two or more keywords.
- Island names are invented toponyms defined in the config; settlement names
  are project titles.
- Layout is deterministic and seeded so the map is identical on every visit.
  Allow an optional `map` override field in the project JSON for position
  nudges; do not otherwise change the schema.

## Rendering

- Islands are raster art generated with Higgsfield from concept 06, one per
  category with a transparent background and the assigned biome. Composite
  them in a WebGL layer over a shader sea with foam at the coastlines. Scale
  from project count.
- Settlements are five sprite tiers cut from concept 07, placed from data,
  with an additive amber glow sprite at night. Crown and pennant are small
  sprites layered on top.
- Ambient life as tiny sprite loops: chimney smoke, a lighthouse beam that
  sweeps at night, gulls circling harbours, windmill blades that turn at the
  real Astana wind speed. One or two boats crawl along the ferry lanes; in
  storm weather codes they return to harbour and anchor.
- Weather is a fragment shader stack over the composite; see Weather below.
- Labels, tooltip card, HUD, minimap, timeline and the view switch are DOM
  elements above the canvas for accessibility and routing.
- One small WebGL helper library is allowed. No other new runtime
  dependencies.
- Provide a static poster fallback (a single rendered PNG with plain DOM
  hotspots) for devices without WebGL and for reduced motion.

## Interaction

- Drag pan, wheel and pinch zoom, double-click zoom, arrow keys and WASD,
  a minimap that also serves as a category legend, and click on an island
  name to fit that island.
- Hover on a settlement: gold ring fades in, label rises, window glow
  brightens, its sea lanes light up gold, the rest of the map dims slightly,
  and the tooltip card appears with the existing WorkCard content.
- Click: the camera zooms toward the settlement, then routes to
  `/works/:slug` reusing the existing cover-to-hero morph. Back restores the
  previous viewport exactly.
- Fog of war: islands start under thin fog and clear as the visitor hovers
  or visits. Revealed settlements persist in localStorage. The HUD shows
  "surveyed N of 29 settlements".
- Stack as trade goods: hovering a tool in the legend, such as QGIS, lights
  up every settlement that used it and its lanes.
- Intro fly-in on first visit only: the camera descends through clouds to
  the archipelago while the HUD fades in. Skipped on repeat visits and under
  reduced motion.
- Keyboard focus moves between settlements in sheet order; a visually hidden
  list mirrors the map for screen readers.

## Chronicle slider

A timeline scrubber at the bottom of the HUD from the earliest `startDate` to
today. Dragging it shows the archipelago at that date: settlements appear
when their project starts, grow through tiers as it progresses, and finish
at their final tier on `endDate`. Sea lanes appear when both ends exist.
Releasing the slider animates back to today. Under reduced motion it jumps
without animation.

## Weather

- Source: Open-Meteo forecast API for Astana (51.17 N, 71.43 E): weather
  code, temperature, wind speed and direction, cloud cover, sunrise, sunset.
  Poll every 15 minutes, cache in localStorage, fall back to clock-based day
  and night when the fetch fails.
- Effects: rain and snow slanted by wind, snow accumulation mask on land,
  sea ice at coastlines below 0°C, clouds drifting with the wind and casting
  shadows, fog, sun glitter on shallows and shadow direction by real hour,
  lightning for thunderstorm codes, day and night tint from sunrise and
  sunset.
- Weather changes cross-fade over ten seconds rather than snapping.
- Seasons from the date: autumn foliage tint in October and November, spring
  meadow tint in April and May, on top of live snow cover from temperature.
- Night sky draws the real lunar phase from the date.
- The HUD weather readout shows condition icon, temperature and wind, as in
  concept 10, so the visitor understands why the map is snowing. One line
  under it says the map lives in Astana's weather.
- Cap particle counts. Under reduced motion the weather layer is static.

## Audio and export

- Ambient audio: waves, wind and blizzard howl mixed by the weather state.
  Muted by default with a toggle in the HUD. Never autoplay with sound.
- Export chart: a HUD button that renders the current view with HUD to a PNG
  and offers it as a download.

## View switch

A "Sheet view" button on the map swaps in the current landing page; a "Map
view" button on the sheet swaps back. Persist the choice in localStorage.
Default to sheet view for reduced-motion users, viewports under 640px, and
devices without WebGL.

## Detail page tie-in

Replace the existing locator inset on `/works/:slug` with a small render of
the project's island with a pin on its settlement, in the map style.

## Constraints

- tsc and the production build stay clean.
- Do not touch the existing WorksMap component or its data.
- Position:fixed elements go through a portal, never inside scroll-reveal
  wrappers.
- One requestAnimationFrame loop for the whole map, paused when the tab is
  hidden or the sheet view is active.
- Respect prefers-reduced-motion everywhere listed above.

## Process

Before writing code, present a phased plan, the size-score formula, the
category-to-biome assignment and the island toponyms for approval. Then:

1. Generate the seven island paintings and five settlement sprites with
   Higgsfield from concepts 06 and 07, remove backgrounds, save under
   `public/atlas/`. Show them for approval.
2. Static archipelago: sea shader, islands, settlements, labels, HUD, and the
   view switch.
3. Pan, zoom, hover, click routing, fog of war, keyboard and screen reader
   list.
4. Live Astana weather, weather transitions, seasons, moon, day and night.
5. Ambient life, ships, crown, pennants, trade-goods hover, intro fly-in,
   detail page locator.
6. Chronicle slider.
7. Audio, export chart, poster fallback, performance pass.

Commit at the end of each phase and verify each phase in the browser with a
screenshot before moving on.
