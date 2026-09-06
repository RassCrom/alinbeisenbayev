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
35 lanes today: 20 cross water (`crossing: true`, drawn as sea lanes), 15
join settlements on one island (drawn as roads). Five settlements have no
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
| glow | 512 | RGB on black; drawn additively, no alpha |

Approval: every render was shown as a contact sheet; Qaragai was
regenerated once to remove painted clouds, the glow needed one retry after
a failed job. The background remover trimmed the settlements' ground
patches, which suits compositing onto the paintings.

### Deferred from stage 1

- `docs/cartographic-roadmap.md` and `docs/experiment-map-prompt.md` were
  untracked on main and are committed here so the branch is self-contained.

## Stage 2: static archipelago, HUD, view switch (done)

### Component tree

```
App
  Nav
  main
    HomePage (lazy)                 src/pages/HomePage.tsx: map or sheet by view mode
      AtlasView (lazy chunk)        src/atlas/AtlasView.tsx: owns canvas + rAF loop
        canvas                      AtlasRenderer, WebGL2
        AtlasLanes                  SVG arcs, sea lanes gold dashed, roads tan
        AtlasLabels                 DOM labels, crown and pennant images
        AtlasFocus                  gold ring and the dark-glass card (stage 3)
        AtlasHud                    left: compass, weather placeholder, minimap,
                                    survey count, island legend; right: tier
                                    legend, Sheet view
        nav.atlas-sr-list           visually hidden settlement links (stage 3)
      LandingPage                   unchanged, plus a "Map view" button in the hero
  AppFooter                         Footer, hidden while the atlas is showing at /
```

Supporting modules: `assets.ts` (sprite files, anchors, sizes, loader),
`camera.ts` (Camera, worldToScreen / screenToWorld, fitBounds,
visibleWorld, the view store, clamp, animator, saved camera),
`controls.ts` (gestures), `interaction.ts` (hover, tap, focus state and hit
testing), `fog.ts` (survey persistence), `order.ts` (sheet order),
`viewMode.ts` (map or sheet, localStorage, defaults), `gl/shaders.ts`,
`gl/renderer.ts`, `atlas.css`.

### WebGL

No helper library. Raw WebGL2 in `gl/renderer.ts`: a handful of programs
and textured quads were all that was needed, and a dependency would have
bought abstraction over nothing. Draw order per frame: sea (fullscreen
shader), island paintings back to front, additive amber glow under every
lit settlement, settlement sprites back to front, then (stage 3) the hover
dim with the hovered settlement redrawn on top, and the fog. Textures are
uploaded premultiplied with mipmaps and 4× anisotropy.

The foam is not painted: at start-up the island alphas are drawn into a
1024² texture covering the unit world (`u_land`), blurred twice
(`u_coast`) for the foam and twice more, wider (`u_shelf`), for the
shallows and the fog. WebGL2 is required; without it the view mode falls
back to the sheet and the map never mounts.

`dispose()` frees GPU resources but deliberately does not lose the context:
hot updates and StrictMode remount the view on the same canvas.

### Coordinates

`src/atlas/camera.ts`: `Camera { x, y, zoom }` is the world point at the
viewport centre and CSS pixels per world unit. `worldToScreen(camera,
viewport, x, y)` and `screenToWorld(camera, viewport, x, y)` are the pair
every layer uses; `fitBounds(bounds, viewport, padding)` gives the initial
camera. `createViewStore` holds camera and viewport outside React; lanes,
labels, ring, card and minimap subscribe and write the DOM directly, so a
pan or zoom never re-renders the tree. The renderer reads the camera each
frame and multiplies by devicePixelRatio (capped at 2).

Sprite geometry: an island is a square of half-width `paintingHalfWidth`;
a settlement sprite is `footprint × 1.25` wide (half) with its anchor at
0.76 to 0.8 of its height, where the buildings meet the ground; the glow is
`footprint × 2.1`. Labels hang from the sprite's top edge, or start below
its bottom edge as a fallback.

### Labels

Greedy placement in two passes on every view change: settlements first
(capital, then tier, then score), above the sprite or else below, hidden
when both would overlap something placed; hamlets and ruins only take part
past 1.5× the fitted zoom, except the active one, which always shows.
Island names go last and always show, climbing in 10px steps over open sea
until clear. Titles longer than 30 characters are shortened with an
ellipsis; the full title is in the element's `title`.

### View switch

`atlas:view` in localStorage, `'map'` or `'sheet'`. With nothing stored the
default is the map, except: reduced motion, viewport narrower than 640px,
or no WebGL2, which give the sheet. No WebGL2 also overrides a stored map.
The store caches its snapshot and re-evaluates the default on resize and
motion-preference changes until a choice is stored. The "Sheet view"
button lives in the right HUD panel; "Map view" is a pill at the top right
of the landing hero.

### Deferred from stage 2

- Weather readout shows sample values (−2°C, NW 15 km/h, Astana) until
  stage 4.
- Below 900px the right HUD panel and the island legend are hidden to keep
  the map clear; a compact mobile HUD is not designed yet.
- No handling of `webglcontextlost` yet.

## Water (after stage 2)

The sea shader in `gl/shaders.ts` is a lit wave surface: three directional
wave trains, domain-warped so no crest reads as hatching, plus noise chop;
normals by finite differences one and a half pixels apart, lit from the
upper-right key light with sparse specular glints. Each train fades out
once its wavelength drops under a few screen pixels, so the fitted view
shimmers instead of aliasing and detail arrives with zoom. Depth colour
comes from the wide shelf blur: teal over an uneven shelf broken by
sandbank noise, a sandy bottom and caustic light nearest the shore. Foam
keeps the narrow coast field: a bright edge line, a wave-broken band, and
whitecaps in open water where the wind patches are.

## Stage 3: pan, zoom, hover, routing, fog of war, accessibility (done)

### Camera store

`camera.ts`: the view store (`createViewStore`) holds `{ camera, viewport }`
outside React; every layer subscribes and writes the DOM directly.
`clampCamera` keeps zoom between 0.7× and 9× the fitted zoom and the
viewport centre within 12% of the archipelago bounds. `zoomAround` keeps
the world point under a screen point fixed. `createCameraAnimator(store,
bounds)` runs one tween at a time (`to(target, ms)`, `cancel()`), eased
in-out with zoom in log space; under prefers-reduced-motion every move is a
jump. `saveCamera` / `readSavedCamera` keep the pre-open camera in
sessionStorage (`atlas:camera`); the view restores it when the navigation
type is POP and fits the archipelago otherwise.

`controls.ts`: `attachCameraControls(container, store, animator,
callbacks)` handles drag pan, two-finger pinch (zoom around the midpoint
plus pan), wheel zoom around the cursor (a trackpad pinch arrives as
ctrl+wheel), double-click zoom, arrows and WASD, + and −, Escape. Gestures
that start on the HUD, card, labels or links are left to those elements.
Taps (press and release within 5px) and hover positions come back through
callbacks; the view hit-tests them.

### Hover and routing flow

`interaction.ts`: `createInteractionStore` holds `hovered` (mouse),
`selected` (touch) and `focused` (keyboard); `active()` is the first of
those. `hitTest` finds the front-most settlement whose sprite rectangle
contains a screen point.

On hover: the label lifts (`.is-active`), `AtlasFocus` shows the gold ring
on the ground and the card beside the sprite (flipping to the other side or
sliding vertically to stay on screen), `AtlasLanes` lights the settlement's
lanes gold and dims the rest, the renderer darkens the map by 30% and
redraws the settlement with a brighter glow, and the detail route chunk is
warmed. Touch: first tap selects, second tap on the same settlement opens.
Click or Enter: `openProject` saves the camera, zooms toward the settlement
(2.2× the current or 3.2× the fitted zoom, 480ms), awaits the warmed chunk,
then navigates inside `document.startViewTransition` so the card's cover
(`view-transition-name: cover-<slug>`) morphs into the detail hero, exactly
as WorkCard does. Without the API or under reduced motion it navigates
plainly.

Island names are clickable and fit their island; the minimap is clickable
and recentres the camera.

### Fog of war

`fog.ts`: surveyed slugs in localStorage under `atlas:surveyed`;
`markSurveyed` on hover, tap, keyboard focus and open, and from
WorkDetailPage on any visit; `useSurveyed` for React. The renderer's fog
pass (`FOG_FRAG`) lays haze on land and the last of the shelf, thin over
open sea, and tears it open in soft discs of five footprints around each
surveyed settlement; the view eases each disc in over about half a second.
The HUD shows "surveyed N of 29 settlements".

### Accessibility

A visually hidden list (`.atlas-sr-list`) mirrors every settlement in sheet
order (`order.ts`, the works page's three-tier sort) as links "title,
tier, category". Focusing one sets `focused`, shows the ring and card, and
pans the settlement into view if it is near an edge; Enter opens it,
Escape clears and blurs. The container is focusable for keyboard panning.
Reduced motion: tweens jump, hover strength and fog reveals snap, and the
CSS transitions are off.

### Verified in the browser

Hover on Silk Road: card, ring, five lanes lit and thirty dimmed, label
lifted, survey count 1 of 29 persisted. Click: camera saved, zoom toward
the settlement, route to /works/silk-road with the hero carrying the morph
name. Back: route /, camera restored to the saved values, interaction
cleared. Wheel zoom, keyboard focus and Escape verified through dispatched
events; keyboard pan, island fit and minimap moves verified only by the
camera having moved after the fact, because the hidden preview pane does
not run requestAnimationFrame. Touch taps and pinch are untested.

### Deferred from stage 3

- Label placement still runs synchronously on every store change; fine at
  36 labels, revisit if it grows.
- Touch and pinch paths are written but not exercised on a device.
- A settlement label that overlaps another settlement's sprite can steal
  its hover; a small dead zone would fix it.
- `?atlas-hover=<slug>` and `window.__atlas` exist in dev builds only, for
  headless verification renders.

## Stage 4: live Astana weather, seasons, moon, day and night (done)

### Weather module

`src/atlas/weather/weather.ts`: `WeatherState` (source, observedAt, WMO
code, condition, intensity, temperature, wind speed and direction, cloud
cover, isDay, sunrise, sunset), `conditionFromCode` (the WMO mapping to
eight conditions with a light/moderate/heavy intensity), `fetchAstanaWeather`
(Open-Meteo forecast for 51.17 N 71.43 E with current weather, daily sunrise
and sunset, timezone auto), `readCachedWeather`, `fallbackWeather` (clear
sky, Astana's monthly normal temperature, day or night from the sun),
`presetWeather` for the HUD picker, and `useWeather()`, which polls every
fifteen minutes and again when the tab returns. Cache key `atlas:weather`,
fresh under fifteen minutes, stale over an hour.

`src/atlas/weather/sun.ts`: NOAA solar position and sunrise/sunset for
Astana (checked against Open-Meteo to the minute), and the lunar phase from
the mean synodic month.

`src/atlas/weather/sim.ts`: `targetLook(state, now)` turns a state into the
numbers the shaders take (rain, snow, cloud, haze, storm, ice, wind vector,
day and dusk ramps from the real sun elevation, sun direction, season tint);
`WeatherSim.update(dt, target, instant)` eases every value toward the
target over ten seconds, keeps the snow-cover memory (grows while snowing,
melts above 0°C), and fires lightning in storms. A preset decides day or
night itself; live weather follows the sun.

### Shader list

Sea (`gl/shaders.ts`): `u_sun`, `u_sunlight` (day × clear sky) and `u_ice`
added; glints follow the sun by day and a quarter-strength moonlight by
night; sea ice grows out from the coasts below 0°C, pale and cracked.
`gl/weatherShaders.ts`: `SNOW_FRAG` (lying snow from the land mask and the
cover memory), `GRADE_FRAG` (multiply pass: night, twilight and day tint,
cloud shadows offset away from the sun, longer when it is low),
`SKY_FRAG` (cloud puffs drifting with the wind, fog haze, rain streaks and
snowflakes in screen space slanted by the wind, lightning). Season tint is
the sprite shader's existing `u_tint` on the island paintings: autumn in
October and November, spring green in April and May. Draw order is in the
renderer's header comment. All effects are procedural, so the only caps are
the fixed octave and layer counts; under reduced motion the weather time is
frozen and lightning is off.

### HUD

Condition icon, temperature, wind (compass point and km/h) and condition
name, the line "The map lives in Astana's weather.", a source note in the
tooltip (Open-Meteo time, cached, or fallback with the error), and a
Preview picker with nine presets that never persists. At night a moon with
the real phase hangs at the top right of the map.

### Verified

Live readout matched the API response (26°C, partly cloudy, SW 9 km/h at
12:15 local). Headless renders of live, clear night, snow, blizzard, rain,
thunderstorm, fog and summer sun via the dev-only `?atlas-weather=<preset>`
hook, which also snaps the cross-fade so the render shows the settled
look. Frame time could not be measured this session: the preview pane was
hidden and did not run requestAnimationFrame; `window.__atlas.frameMs`
(dev) reports a running average when the tab is visible.

### Deferred from stage 4

- Lightning is a flash only; concept 11's forked bolts are not drawn.
- Sun glitter is generic specular; a dedicated glitter band on the
  shallows along the sun direction would read stronger at low sun.
- Cloud shadows are cast on sea and land alike; the paintings' own baked
  shadows still point to the upper right regardless of the hour.
- Weather changes cross-fade; the sea ice and snow cover have their own
  slower memories and are not reset by the picker.

## Stage 5: ambient life, ships, trade goods, fly-in, detail locator (done)

### New sprites

Five more cut-outs in `public/atlas/`, generated with the two concept
sheets as references and processed by `scripts/prepare-atlas-assets.py`
(SIZES extended): `lighthouse.webp` (512), `windmill-tower.webp` and
`windmill-sails.webp` (512 each; the sails are a separate square so they
can turn about the axle at (0.63, 0.30) of the tower), `gull.webp` (256,
painted flying toward the upper left, so `forward` is −2.21 rad) and
`boat.webp` (384, bow to the right). Prompts are in `public/atlas/PROMPTS.md`
under "Ambient life sprites (stage 5)". `src/atlas/assets.ts` describes
them as `LifeSpriteSpec` (a `SpriteSpec` plus a fixed `half` width in world
units and the `forward` heading), and `textureSources` includes them.
Chimney smoke and the lighthouse beam are procedural canvases the renderer
uploads once (`generated:puff`, `generated:beam`).

### Life module

`src/atlas/ambient.ts`:

- `planAmbient(atlas)` places, from the seed, one lighthouse per island on
  the coast (walking the island's bearing out to the last land sample,
  clear of settlements), one harbour per island on the shore nearest its
  seat, and a windmill on every island with three or more settlements.
- `LifeSim` owns the moving parts and is stepped once per frame with the
  weather look: smoke puffs per settlement (none on ruins; alpha by tier,
  fortress thinnest), two gulls per harbour circling with a flap phase, the
  windmill `sailAngle` advancing with the real wind speed, the `beamAngle`
  sweeping steadily, and two boats.
- Boats sail the crossing lanes along the same quadratic curves the SVG
  draws (`src/atlas/lanes.ts`, shared by `AtlasLanes` and the sim), but only
  over the stretch of each curve that is water (`waterSpan`, sampled against
  the land masks, standing a little off the beach). They ease into and out
  of port, wait, then leave along another lane touching that port. A wake
  ring buffer trails behind. When the look reports `storm > 0.5` or
  `snow > 0.7` (thunderstorm, blizzard, heavy snow) every boat turns for the
  nearer shore and anchors there until the weather clears.

Renderer passes 6 and 7 (`gl/renderer.ts`) draw landmarks (tower, sails
rotated by `u_rotation`, lighthouses) and life (wakes, boats, smoke, gulls);
the beam pass draws two additive wedges from the lantern at night only.
Under reduced motion the sim is placed but never stepped.

### Trade goods

`src/atlas/tools.ts` `tradeGoods(projects)` merges every `stack` entry
case-insensitively (the data has both "d3.js" and "D3.js"), keeps the most
used spelling as the label and sorts by settlement count. `AtlasView` keeps
the goods shared by at least two settlements on the map; the HUD's right
panel shows up to ten as chips with counts.

The interaction store gained `tool` (under the pointer or keyboard focus)
and `pinnedTool` (clicked), and a cached `highlights()` list: the active
settlement alone if there is one, else the active good's settlements. Every
layer lights from that list: the renderer dims and redraws all highlighted
settlements (`FrameState.highlights`, `highlightStrength`), `AtlasFocus`
puts a ring under each (the card still needs a single active settlement),
and `AtlasLanes` lights a lane when one highlight touches it, or when both
of its ends are highlighted for a set. Escape and a tap on open sea clear
the pin.

### Fly-in

First visit only: `localStorage['atlas:flown'] = '1'` after the flight
starts. Skipped under reduced motion, on Back (POP), when `defaultViewMode()`
is not `map`, and whenever a dev URL hook asks for a specific state. The
camera starts at 0.3× the fit zoom, offset a little south-east, and eases
(cubic in and out, zoom in log space) to the fit over 3.6 s while
`FrameState.veil` runs from 1 to 0 through the sky pass (extra cloud and
haze). The camera sits outside the clamp on purpose during the flight; any
pointer, wheel or key gesture lands it at once. HUD, moon, lanes and labels
carry `is-arriving` until 62 % of the flight and fade in over 1.1 s.

### Detail locator

`src/atlas/IslandLocator.tsx` (+ `locator.css`) replaces `LocatorInset` in
`SourceNote`: the project's island painting in a dark sea box with a pulsing
gold pin at the settlement's position within the painting square and a
caption of island name, tier and category. The atlas is built once per
session for it. `LocatorInset` itself is left in place, unused. The source
note aside now has `id="source-note"`, and the detail page scrolls a hash
target into view on mount (the router does not).

### Dev hooks

`?atlas-hover=<slug>`, `?atlas-tool=<key>`, `?atlas-weather=<preset>`,
`?atlas-flyin[=hold]` (force the flight; `hold` freezes it at 38 %), and
`?atlas-camera=x,y,zoom` (zoom as a multiple of the fit). `window.__atlas`
also exposes `life` and `plan`.

### Sea

Glints now break into flecks (a fine noise mask) and thin out above about
1800 px per world unit; before this, a lit crest at close zoom ran as a
continuous diagonal line and the water read as hatching or rain.

### Verified

Headless renders: the fitted view with lighthouses and windmills; QGIS
pinned (17 settlements ringed, lanes between them lit, the rest dimmed);
Jailau's harbour close up (windmill sails, gulls, the flecked water); a
boat off Ottas under the thunderstorm preset; lighthouse beams under the
clear-night preset; the flight held at 38 % with the veil up. A node run
of `LifeSim` (60 fps for 20 s calm, then 80 s storm) shows both boats
sailing, then anchored at the shore ends of their lanes and staying there.
The locator on `/works/asharshylyq` was verified in the DOM (island
painting, pin at the settlement, caption "Jailau · walled town · social
media"); a headless capture of it was not possible because the page is
taller than a screenshot and the preview pane does not paint while hidden.
Frame time again could not be measured for the same reason as stage 4.

### Deferred from stage 5

- The wake is drawn as fading rings; it does not perturb the sea shader.
- The trade-goods row is text chips, not tool icons.
- Boats ease at ports but do not turn to face the quay; a docked boat
  keeps its last heading.
- No frame-time numbers; `window.__atlas.frameMs` awaits a visible tab.

## Stage 6: chronicle slider (done)

### Selector

`src/atlas/chronicle.ts`. Months are counted as year × 12 + month, the
unit `score.ts` already used (its `monthIndex` is now exported).

- `chronicleRange(projects, atlas)` → `{ first, last }`: the earliest
  `startDate` to `atlas.asOf`.
- `atlasAt(atlas, projects, month)` → `ChronicleFrame { month, states,
  laneIds, settledIslands }`. A settlement exists from its start month;
  it appears as a hamlet and climbs one tier at a time toward today's tier,
  each tier taking an equal share of the project's duration, arriving in
  the end month. In-progress work stays a ruin. The crown and the pennant
  appear in the end month. A lane exists once both ends do. Open-ended
  dates resolve to `atlas.asOf`, the month the scores were computed for,
  so at that month the frame reproduces today's atlas exactly
  (`frameMatchesToday`; `node scripts/print-atlas.ts --check-chronicle`
  asserts it and prints the growth by year, exit 1 on a mismatch).
- `chronicleAtlas(atlas, frame)` → an `Atlas` for the DOM layers: absent
  settlements dropped, tiers and marks as they stood, lanes filtered,
  positions and bounds untouched. With no frame the view uses the base
  atlas object itself, so the current-day path is byte-for-byte the same.

### Store

`createChronicleStore()` holds `{ month: Month | null, pinned, scrubbing }`;
`month === null` means today. `AtlasView` derives `frame` and `viewAtlas`
from the month with `useMemo` and passes `viewAtlas` to lanes, labels,
focus and HUD; hit-testing uses it too, so absent settlements cannot be
hovered. The screen-reader list and the fog reveals stay on today's atlas.

### Animation

The renderer's `FrameState.chronicle` is a map of `SpriteState { tier,
prevTier, blend, presence }` kept by the view's frame loop only while a
date is shown or the map is settling back; null draws today through the
unchanged path. A tier change cross-fades the two sprites over 0.45 s; a
settlement fades in or out of existence through `presence`. A growing
settlement is drawn at the footprint of the tier it has reached. On
release, unless the lock holds it, the month eases back to today
(exponential, about a second) and the states settle. Under reduced motion
everything jumps and the return is immediate.

### HUD

A third panel, top left: eyebrow, the month (or "Today"), a padlock that
pins, a range input from the first month to today with year ticks under
the track, and "N settlements, M of 7 islands settled" for the shown
month. The tier counts in the right panel and the survey count follow the
shown atlas as well. Dragging or keying sets `scrubbing`, so the return
waits for release. Dev hook: `?atlas-date=YYYY-MM` opens held at that
month.

### Verified

`--check-chronicle`: January 2022 to September 2026, today matches the
atlas, settlements monotonic. Headless renders held at June 2024 (2
settlements, no lanes), June 2025 (14 settlements, the first sea lanes,
Tigranes and Silk Road at fortress) and March 2026 (17 settlements, the
capital crowned). The release ease-back and the cross-fades run in the
frame loop and could not be captured headlessly.

### Deferred from stage 6

- Boats keep sailing today's lanes while a past month is shown.
- Growth is stepped per tier, not scored per month; a project's score
  history is not reconstructed.
- The trade-goods chips count today's settlements while scrubbed.
