# experiment-map stage prompts

Each file in this folder is a complete prompt for one stage. Paste one file
into a fresh chat. Every stage:

1. starts by reading `docs/atlas-status.md`, which the previous stage wrote;
2. does only its own scope;
3. ends with a commit on `experiment-map` and an updated `docs/atlas-status.md`
   describing what exists, where, and any deviations from the plan.

Order:

| Stage | File | Deliverable |
| --- | --- | --- |
| 1 | `stage-1-foundation.md` | branch, plan approval, data layer, generated assets |
| 2 | `stage-2-static-map.md` | sea, islands, settlements, labels, HUD, view switch |
| 3 | `stage-3-interaction.md` | pan, zoom, hover, routing, fog of war, accessibility |
| 4 | `stage-4-weather.md` | live Astana weather, seasons, moon, day and night |
| 5 | `stage-5-life.md` | ambient sprites, ships, crown, pennants, trade goods, fly-in, locator |
| 6 | `stage-6-chronicle.md` | timeline slider |
| 7 | `stage-7-polish.md` | audio, export, poster fallback, performance |

Stages 1 to 4 make a shippable first version. Stages 5 to 7 are additive and
can each be skipped or reordered.

Reference images live in `docs/concepts/`. The north star is
`10-realistic-hover-hud.png`.
