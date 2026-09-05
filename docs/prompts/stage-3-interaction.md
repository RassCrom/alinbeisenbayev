# Stage 3 of 7: pan, zoom, hover, routing, fog of war, accessibility

## Context

Read `docs/atlas-status.md` first. Stages 1 and 2 built `src/atlas/` with the
data layer, a WebGL `AtlasView` at `/`, DOM labels, HUD, minimap and a view
switch. `worldToScreen` and `screenToWorld` exist. Branch: `experiment-map`.

Project facts: React 18 + Vite + Tailwind 4 + TypeScript, react-router 6.
`WorkCard` is the existing project card component. The works grid already
morphs a card's cover into the hero of `/works/:slug`; reuse that mechanism.
Position:fixed elements must go through a portal.

Art direction for hover is `docs/concepts/10-realistic-hover-hud.png`: gold
selection ring on the ground, label rises, sea lanes glow gold, rest of the
map dims slightly, dark glass tooltip card with cover, title, one line of
description and tag pills.

## This stage

### 1. Camera

Drag pan, wheel and pinch zoom around the cursor, double-click zoom, arrow
keys and WASD, clamped so the archipelago cannot leave the viewport. The
minimap shows the viewport rectangle and is clickable. Clicking an island
name animates the camera to fit that island. Camera state lives in one store
so stage 5 and 6 can drive it.

### 2. Hover

Hovering a settlement: gold ring fades in, the label rises and enlarges,
window glow brightens, its sea lanes light up gold, everything else dims by
a small amount, and a tooltip card built from `WorkCard` content appears
beside it, flipped to stay on screen. Touch: tap selects, second tap opens.

### 3. Click and routing

Click zooms the camera toward the settlement over a short duration, then
routes to `/works/:slug` reusing the existing cover-to-hero morph from the
tooltip card's cover. Back restores the exact previous camera state and the
hover state cleared.

### 4. Fog of war

Islands start under a thin fog layer. Hovering a settlement or visiting its
project clears fog around it; revealed settlements persist in localStorage.
The HUD shows "surveyed N of 29 settlements" using the real count.

### 5. Accessibility

Keyboard focus moves between settlements in sheet order with Tab, Enter
opens, Escape clears. A visually hidden list mirrors every settlement with
its title, tier and category for screen readers. Every animation in this
stage respects prefers-reduced-motion by jumping instead of tweening.

## Constraints

- tsc and the production build stay clean.
- No new runtime dependencies.
- Do not touch `WorksMap` or the project JSON.

## Done when

- Every interaction above is verified in the browser, including Back
  restoring the viewport, with screenshots of the hover state and the fog;
- `docs/atlas-status.md` is updated with the camera store API, hover and
  routing flow, fog storage key, and anything deferred;
- everything is committed on `experiment-map`.
