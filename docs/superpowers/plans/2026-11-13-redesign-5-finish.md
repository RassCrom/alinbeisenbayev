# Redesign Plan 5: Finish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove what the redesign retired, give the footer its illustration and the 404 page the new system, and measure the site against its weight and speed budgets.

**Architecture:** Deletions first, so the measurements describe the site that will ship. The illustration is one inline SVG component in three layers. Speed is measured on the built site with a throttled phone profile through the DevTools protocol.

**Tech Stack:** as before. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-12-site-redesign-design.md` (sections "Removed", "Footer", "Shared", "Weight and fallbacks", "Order of work" step 7)

## Global Constraints

All earlier constraints apply. In addition:

- Budgets, on the built site with a throttled phone profile: home script 90 KB gzipped, styles 20 KB, largest image 150 KB, total before scrolling 500 KB, largest contentful paint under 2.5 s, layout shift under 0.05.
- A budget that fails is fixed or reported with its number. It is never raised to pass.
- The illustration: original line drawing, the icons' 1.6 stroke with round caps and joins, drawn in `--text-2` and `--line`, with one detail in `--accent`. Still under reduced motion. Decorative: hidden from assistive tech.
- No invented readings anywhere: the 404 page loses its made-up coordinates and sheet notes.

## Review Focus

1. **A stored atlas preference** (`localStorage` keys the atlas wrote). The home page ignores them. Check in Task 1.
2. **A bookmarked atlas asset** (`/atlas/poster.webp`). It is gone; nothing on the site links to it. Check in Task 1.
3. **The 404 page reached by a deep path** (`/works/no-such-work`). It still offers the three ways back. Test in Task 2.
4. **A very wide or very narrow footer.** The illustration scales without cropping the figure. Check in Task 3.
5. **A slow phone.** The first screen is usable before the hero covers have loaded. Measure in Task 4.

---

### Task 1: Delete the atlas

**Files:** delete `src/atlas/`, `public/atlas/`, `scripts/print-atlas.ts`, `scripts/atlas-shot.mjs`, `scripts/bake-atlas-poster.py`, `scripts/prepare-atlas-assets.py`; modify `package.json` (drop `atlas:print`), `public/_headers`, `vercel.json`, `src/types/index.ts` (drop `Project.map` and atlas mentions), `public/vienna-contours.webp` and `public/astana-contours.webp` if nothing uses them.

- [ ] **Step 1: Write the failing test** in `src/styles/redesigned.test.ts`: `src/atlas` does not exist; no file under `src` or `scripts` contains `atlas/` in an import or path; `package.json` has no `atlas:print`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Delete and edit.** Project JSON `map` fields, if any, are removed with the type.
- [ ] **Step 4: Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm budget`.** Expected: pass; `dist` holds no `atlas` file.
- [ ] **Step 5: Commit.** "Delete the atlas"

### Task 2: The 404 page

**Behaviour:** h1 `Off the edge of the map`; one line: `This address is not on the site. The page may have been renamed or removed.`; three quiet buttons to `/works` (`See the work`), `/journal` (`Read the journal`) and `/` (`Back to start`). No coordinates, no sheet notes, no contour image. Still `noindex`.

- [ ] **Step 1: Write the failing test:** the heading, the line, the three links and their targets; no text matching a coordinate; a `noindex` robots tag is set.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Rewrite `NotFoundPage`.**
- [ ] **Step 4: Run tests and type check.** Expected: pass.
- [ ] **Step 5: Commit.** "Rebuild the 404 page"

### Task 3: The footer illustration

**Files:** create `src/components/FieldCartographer/FieldCartographer.tsx`; modify `Footer.tsx`, `system.css`.

**The drawing:** a cartographer in the field, seen from the side at a plane table on a tripod, sighting along an alidade; a ranging pole with a small flag stands on the next rise; contour lines roll across the foreground and two ridge lines close the distance. Three layers (`far`, `mid`, `near`), each a `<g>`. The flag is the one accent detail.

**Interfaces:** `export default function FieldCartographer(): JSX.Element` renders `<svg class="field-cartographer" aria-hidden="true" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">` with `g.field-cartographer__far`, `__mid`, `__near`.

**Motion:** where `animation-timeline: view()` is supported and motion is allowed, the far layer drifts 24 px and the mid layer 12 px against the near one as the footer scrolls in. Otherwise the drawing is still.

- [ ] **Step 1: Write the failing test:** the svg is `aria-hidden`, has the three layer groups, every stroked element inherits the 1.6 stroke from the root, exactly one element uses the accent class; the footer renders it above its links.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Draw it.** Check at 1440, 768 and 375 and at 2200 wide; send the screenshot for approval.
- [ ] **Step 4: Run tests and type check.** Expected: pass.
- [ ] **Step 5: Commit.** "Add the field cartographer to the footer"

### Task 4: Weight and speed

- [ ] **Step 1: Measure** `/` and `/works` on `vite preview` with 4x CPU slowdown and a 1.6 Mbps / 150 ms network: largest contentful paint, layout shift, bytes transferred before any scroll, and the largest image. Write the script as `scripts/measure-page.mjs` (DevTools protocol, Edge), which prints the numbers and kills its browser.
- [ ] **Step 2: Compare with the budgets.** For each miss, find the cause and fix it (cover sizes and `sizes` attributes first), then measure again.
- [ ] **Step 3: Record** the final numbers in the commit message and the final report, including any budget still missed.
- [ ] **Step 4: Commit.** "Measure the home and works pages against their budgets"

### Task 5: Walkthrough and what is left

- [ ] **Step 1:** Walk every route at 1440 and 375. Expected: no console errors, no horizontal overflow, no browser process left.
- [ ] **Step 2:** List, with file names, what still uses the legacy alias tokens (the map tools and the image viewer) so the next pass has a starting point. Do not remove the alias block while they do.
- [ ] **Step 3:** Update the memory note.
