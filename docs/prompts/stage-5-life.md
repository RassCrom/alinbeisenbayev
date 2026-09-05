# Stage 5 of 7: ambient life, ships, trade goods, fly-in, detail locator

## Context

Read `docs/atlas-status.md` first. Stages 1 to 4 built a WebGL archipelago at
`/` in `src/atlas/` with data layer, camera store, hover and routing, fog of
war, and live Astana weather in a `WeatherState`. Branch: `experiment-map`.

Existing pieces: `LocatorInset` is the small real-world inset on
`/works/:slug`. The `stack` field on each project lists tools such as QGIS
and Figma. The sprite assets live in `public/atlas/`.

## This stage

### 1. Ambient life

Tiny sprite loops, all driven by the shared frame loop:

- chimney smoke on every settlement, thinner at higher tiers;
- one lighthouse per island on the coast, its beam sweeping only at night;
- gulls circling harbours;
- windmills whose blade speed follows the real wind speed from
  `WeatherState`.

Generate any missing sprites with Higgsfield in the same lighting and record
prompts in `public/atlas/PROMPTS.md`.

### 2. Ships

One or two boats crawl along the sea lanes, easing at ports. In thunderstorm
and heavy snow codes they return to the nearest harbour and anchor. Their
wake reacts to the sea shader.

### 3. Stack as trade goods

The legend gains a row of tool icons from the union of all `stack` values.
Hovering a tool lights up every settlement that used it and their lanes,
using the same treatment as settlement hover. Clicking pins the highlight.

### 4. Intro fly-in

On the first visit only, the camera starts above the clouds and descends to
the fitted archipelago over a few seconds while the HUD fades in. Store a
flag in localStorage; skip under prefers-reduced-motion and when the sheet
view is the default.

### 5. Detail page locator

On `/works/:slug`, replace `LocatorInset` with a small static render of the
project's island with a pin on its settlement, in the map style. Reuse the
island painting and layout from `buildAtlas`; no WebGL needed here.

## Constraints

- tsc and the production build stay clean.
- No new runtime dependencies.
- The frame budget must not regress from stage 4's measurement by more than
  a small margin; note the numbers.

## Done when

- Each feature is verified in the browser with a screenshot, including
  ships anchoring under a storm override and the trade-goods hover;
- `docs/atlas-status.md` is updated with the new sprites, the trade-goods
  data path, the fly-in flag, and anything deferred;
- everything is committed on `experiment-map`.
