# Stage 2 of 7: static archipelago, HUD, view switch

## Context

Read `docs/atlas-status.md` first; it describes what stage 1 built. In short:
`src/atlas/` holds the data layer with `buildAtlas(projects)` returning
islands, settlements and lanes in 0 to 1 world space, and `public/atlas/`
holds generated island paintings, settlement sprites, glow, crown and pennant
sprites. The branch is `experiment-map`.

Project facts: React 18 + Vite + Tailwind 4 + TypeScript. Routes in
`src/App.tsx`; `/` is `LandingPage`. Theme uses `-rgb` triplet tokens in
`src/styles/global.css`. Scroll-reveal wrappers keep a transform, so anything
position:fixed must go through a portal.

Art direction: `docs/concepts/10-realistic-hover-hud.png`. Painted terrain,
deep navy sea with foam at the coast, amber window glow, floating serif
capital labels, dark glass HUD panels with bone text and thin gold lines.
The map view is dark-only by design and must not break the theme elsewhere.

## This stage

### 1. Renderer

Create `src/atlas/AtlasView.tsx` and supporting files. One WebGL canvas
renders, in order: a shader sea (deep navy, subtle moving wave texture, foam
band along each coastline derived from the island alpha), the island
paintings scaled from `buildAtlas`, the settlement sprites by tier, the
additive amber glow sprite on every settlement. One small WebGL helper
library is allowed; pick one and state why. One requestAnimationFrame loop,
paused when the tab is hidden.

Above the canvas, a DOM layer positions labels from world space: island names
in spaced serif capitals, settlement names in serif capitals sized by tier,
the capital with the crown sprite above its label, awarded projects with a
pennant. Labels must not overlap; hide the smallest tier at low zoom.

Provide a `worldToScreen` and `screenToWorld` pair in one module; stage 3
will use them for interaction.

### 2. HUD

Bottom-left, as in concept 10: a compass, a weather readout placeholder
(icon, temperature, wind; real data arrives in stage 4), and a minimap that
shows island outlines and doubles as the category legend. Bottom-right: the
settlement tier legend. All dark glass panels, bone text, gold lines.

### 3. View switch

`/` renders `AtlasView` by default with a "Sheet view" button in the HUD.
`LandingPage` gains a "Map view" button. Persist the choice in localStorage.
Default to sheet view under prefers-reduced-motion, for viewports under
640px, and when WebGL is unavailable. Nav and footer behave sensibly in both.

## Constraints

- tsc and the production build stay clean.
- Do not touch `WorksMap` or the project JSON beyond stage 1's `map` field.
- The atlas must not render while the sheet view is active.
- Keep the existing landing page working exactly as before when shown.

## Done when

- The archipelago renders with every island, settlement, label, crown and
  pennant at the correct place, verified in the browser with a screenshot;
- the view switch works both ways and persists;
- `docs/atlas-status.md` is updated with the component tree, the chosen
  WebGL helper, the coordinate helpers, and anything deferred;
- everything is committed on `experiment-map`.
