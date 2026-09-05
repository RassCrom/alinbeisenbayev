# Stage 7 of 7: audio, export, poster fallback, performance

## Context

Read `docs/atlas-status.md` first. Stages 1 to 6 built a complete WebGL
archipelago at `/` in `src/atlas/` with live weather, ambient life and a
chronicle slider. Branch: `experiment-map`.

## This stage

### 1. Ambient audio

Waves, wind and blizzard howl as short looping files under `public/atlas/`,
mixed by `WeatherState` with gentle cross-fades. Muted by default with a
toggle in the HUD; never autoplay with sound. Generate the loops with the
Higgsfield audio tools or use royalty-free files and note the source.

### 2. Export chart

A HUD button that renders the current view, including HUD and labels, to a
PNG and offers it as a download named with the date and the Astana weather.
Use the WebGL canvas plus a DOM-to-canvas pass for the labels and HUD; no
new dependency if avoidable, otherwise one small one with a reason.

### 3. Poster fallback

For devices without WebGL, render one pre-baked PNG of the archipelago at
today's layout with plain DOM hotspots over each settlement that route to the
project. Add a build script that regenerates the poster from `buildAtlas`.

### 4. Performance pass

- Profile on a mid-range laptop and a phone; record frame times in
  `docs/atlas-status.md`.
- Lazy-load the atlas bundle so the sheet view and the rest of the site do
  not pay for it.
- Reduce particle counts and sprite loops on low-power devices using
  `navigator.hardwareConcurrency` and a frame-time watchdog.
- Confirm the loop is paused when the tab is hidden, when the sheet view is
  active, and during route transitions.
- Run Lighthouse on `/` in both views and fix anything that dropped.

### 5. Wrap-up

- Update `docs/cartographic-roadmap.md` with a section on the atlas view and
  the ideas not built.
- Write a short PR description for `experiment-map` against `main` listing
  each stage, but do not open or merge the PR.

## Constraints

- tsc and the production build stay clean.
- Everything remains behind the view switch; the sheet view is untouched.

## Done when

- Audio toggle, export and poster fallback are verified in the browser, the
  fallback by forcing WebGL off;
- performance numbers are recorded and the atlas bundle is code-split;
- `docs/atlas-status.md` marks the project complete with a list of known
  gaps;
- everything is committed on `experiment-map`.
