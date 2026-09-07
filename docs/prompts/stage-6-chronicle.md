# Stage 6 of 7: chronicle slider

## Context

Read `docs/atlas-status.md` first. Stages 1 to 5 built a WebGL archipelago at
`/` in `src/atlas/` with data layer, camera store, hover and routing, fog of
war, live weather, and ambient life. Branch: `experiment-map`.

Data: every project has `startDate` (YYYY or YYYY-MM) and `endDate` (same,
or "Present"). `src/utils/projects.ts` has date helpers. The size score in
`src/atlas/score.ts` maps a project to a tier.

## This stage

### 1. Slider

A timeline scrubber in the HUD from the earliest `startDate` to today, with
year ticks. Dragging sets a "chronicle date" in the store.

### 2. Time-dependent atlas

Extend `buildAtlas` or add a `atlasAt(date)` selector so the layout reflects
a date: a settlement exists only from its `startDate`, appears as a hamlet
and grows through tiers toward its final tier on `endDate`, staying a ruin
while in progress. Sea lanes exist only when both ends exist. Awards and the
crown appear on the date the project finished. Island paintings never
change; positions never change.

### 3. Animation

Settlement tier changes cross-fade sprites. Releasing the slider eases back
to today unless the visitor pins it with a small lock control. Under
prefers-reduced-motion everything jumps.

### 4. Readout

The HUD shows the scrubbed date and "N settlements, M islands settled" for
that date. Hover and click still work while scrubbed; the tooltip shows the
project as it is today.

## Constraints

- tsc and the production build stay clean.
- No new runtime dependencies.
- The current-day layout must be identical with and without this stage.

## Done when

- Scrubbing from the first year to today plays the archipelago's growth,
  verified with screenshots at three dates;
- `docs/atlas-status.md` is updated with the selector API and the store
  fields, and anything deferred;
- everything is committed on `experiment-map`.
