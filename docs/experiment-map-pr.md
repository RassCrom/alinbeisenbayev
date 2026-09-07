# PR: the atlas view (`experiment-map` → `main`)

Not opened; this is the description to paste when it is.

---

## An archipelago of the works at `/`

Behind the view switch, `/` becomes a fictional archipelago: one island per
project category, one settlement per project sized by a score of the data,
sea lanes between related works, under Astana's live weather, with a
chronicle slider that replays how the body of work grew. The sheet view
(the landing page) is untouched and stays the default on narrow screens,
under reduced motion, and wherever WebGL2 is missing; the atlas is a
separate chunk the sheet never loads.

Everything lives in `src/atlas/` with no new runtime dependency. Raw
WebGL2, one requestAnimationFrame loop that stops when the tab is hidden
or the view unmounts, DOM layers for text and controls, and a data layer
that is pure and printable from node. `docs/atlas-status.md` is the full
record; `docs/prompts/` holds the seven stage briefs.

### Stages

1. **Foundation.** Size score (featured, gallery, process, duration) to
   five tiers; seeded, deterministic layout of islands and settlements;
   lanes from shared keywords and series; land masks baked from the
   paintings; `npm run atlas:print` prints and checks the layout. Assets
   generated from two concept sheets and processed to WebP.
2. **Static map.** Sea, island paintings, settlement sprites, glows, an
   SVG lane layer, a greedy label layer with crowns and pennants, the
   dark-glass HUD with compass, minimap and legends, the view switch.
   Then the sea rebuilt as a lit wave surface with shelves, foam and
   glints.
3. **Interaction.** Camera store, clamp and tweens; drag, wheel, pinch and
   keyboard; hover ring and card; zoom-and-route into a sheet inside a view
   transition, camera restored on Back; fog of war torn open around
   surveyed settlements; a screen-reader list in sheet order.
4. **Weather.** Open-Meteo forecast for Astana with cache and fallback,
   NOAA sun position and lunar phase, a ten-second cross-fade sim, rain,
   snow and snow cover, sea ice, clouds and their shadows, fog, lightning,
   season tint, a preview picker.
5. **Life.** Lighthouses with night beams, windmills turning with the real
   wind, gulls, chimney smoke, boats on the lanes that anchor in storms;
   the stack as trade goods that light every settlement using a tool; a
   first-visit fly-in; the detail page's locator replaced by the island
   with a pin.
6. **Chronicle.** `atlasAt(month)`: settlements from their start month,
   growing a tier at a time to today's size, ruins for work in progress,
   crown and pennant on completion; a slider with year ticks, a lock, and
   an ease back to today. Today's layout is byte-identical, checked by
   `--check-chronicle`.
7. **Polish.** Procedural ambient sound (off by default), a PNG chart
   export of the current view, a pre-baked poster with links for browsers
   without WebGL, a lite quality tier with a frame-time watchdog,
   Lighthouse numbers, and this description.

### Checks

- `tsc` and `vite build` clean at every stage; the atlas is its own chunk.
- `node scripts/print-atlas.ts --check-chronicle` exits 0.
- Headless renders for every stage are described in `docs/atlas-status.md`,
  with the dev-only URL hooks used to reach each state.
- Lighthouse (production preview, desktop): sheet view 95 / 100 / 100 / 100,
  map view 61 / 100 / 100 / 100; the map's score is blocking time from WebGL
  setup under software rendering.

### Known gaps

See "Known gaps" at the end of `docs/atlas-status.md`: frame times were not
measured on a phone or on real GPUs, the chart export falls back to Georgia
for the web fonts, the trade goods are chips rather than icons, and the
boats sail today's lanes while the chronicle shows a past month.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
