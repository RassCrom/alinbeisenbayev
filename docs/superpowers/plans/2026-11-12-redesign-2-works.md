# Redesign Plan 2: Works Index and Work Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One works index that holds projects and gallery pieces together, filterable by offer, and a rebuilt work page with a full and a short layout.

**Architecture:** A data module turns projects and gallery items into one list of `WorkEntry`. The index page reads its filter state from the URL, lays entries out in shortest-column-first columns and adds them in batches as the visitor scrolls. Pieces open in the existing lightbox. The MapLibre works map moves behind a switch and loads only when chosen.

**Tech Stack:** as plan 1 (React 18, React Router 6, vitest). No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-12-site-redesign-design.md` (sections "Works index", "Work page", "Removed", "Weight and fallbacks")

## Global Constraints

All of plan 1's constraints apply. In addition:

- Offer slugs: `custom-maps`, `spatial-analysis`, `data-visualization`, `data-journalism`, `remote-sensing`.
- Filter state lives in the URL: `/works?offer=<slug>`, `&q=<text>`, `&item=<piece id>`, `&view=map`.
- A card's type line is the label of its first offer.
- Video is poster first, `preload="none"`, never autoplays on touch, with data saver on, or with reduced motion.
- MapLibre is not in the works page's static import graph.
- Every rebuilt file is appended to `REDESIGNED` in `src/styles/redesigned.test.ts`.
- Commit after every task, with `&&` after the test run.

## Review Focus

1. **A new gallery item with no `offers` yet** (the gallery script does not write them). The index must still list it, under "All", and the data test must name it. Test in Task 1.
2. **`?offer=` with an unknown value, or `?item=` naming a piece that does not exist.** The page shows everything and opens nothing. Test in Task 3.
3. **A filter that matches nothing.** The page says so and offers one way back. Test in Task 3.
4. **A project with no gallery, no videos and no text.** Its page still shows the cover, title, facts and links. Test in Task 4.
5. **Touch devices on video pieces.** A tap opens the lightbox; no preview video is ever attached. Test in Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `src/data/projects/*.json`, `src/data/gallery.json` | gain `offers`; gallery items gain cleaned `title` and optional `workSlug` (modify) |
| `scripts/gallery.py` | keeps `offers` and `workSlug` across re-runs (modify) |
| `src/data/works.ts` | `WorkEntry`, the merged list, filtering, column distribution (new) |
| `src/components/FilterChip/FilterChip.tsx` | one pressed-state chip (new) |
| `src/components/PieceCard/PieceCard.tsx` | a gallery piece as a card (new) |
| `src/components/Frame/Frame.tsx` | gains `srcSet` and `overlay` props (modify) |
| `src/components/WorkCard/WorkCard.tsx` | type line from first offer; optional `ratio` (modify) |
| `src/pages/WorksPage.tsx` | the index (rewrite) |
| `src/pages/works/WorksMapView.tsx` | the existing map view, moved out of the page (new, legacy styling) |
| `src/pages/WorkDetailPage.tsx` | full and short layouts (rewrite) |
| `src/components/ContactBand/ContactBand.tsx` | optional heading, line and offer (modify) |
| Deleted | `src/pages/GalleryPage.tsx`, `src/components/GalleryMosaic/`, `src/components/SearchFilter/`, `src/hooks/useProjectFilter.ts` |

---

### Task 1: Offers on every entry, and the merged list

**Files:** the JSON data, `scripts/gallery.py`, `src/types/index.ts`, `src/data/works.ts`, `src/data/works.test.ts`

**Interfaces:**
- `Project.offers: OfferSlug[]`; `GalleryItem.offers?: OfferSlug[]`, `GalleryItem.workSlug?: string` (the piece is already shown on that project's page, so the index does not list it separately).
- Produces:

```ts
export type WorkEntry = {
  id: string; title: string; offers: OfferSlug[];
  cover: string;          // image to show: project cover, piece image, or video poster
  ratio: number;          // width / height the card reserves; projects 4/3, pieces native clamped to 0.7..1.78
  when: number;           // sortable, larger is newer
  search: string;         // lower-cased text the query matches
} & ({ kind: 'project'; project: Project } | { kind: 'piece'; item: GalleryItem });

export const workEntries: WorkEntry[];                       // listed projects + unlinked pieces, newest first
export function parseOffer(value: string | null): OfferSlug | null;
export function filterEntries(entries: WorkEntry[], offer: OfferSlug | null, query: string): WorkEntry[];
export function distribute<T extends { ratio: number }>(entries: T[], columns: number): T[][];
export function firstOfferLabel(offers: OfferSlug[]): string;  // '' when there is none
```

- `when`: a `YYYY`, `YYYY-MM` or `YYYY-MM-DD` date becomes months since year 0 plus day/31; a project uses `endDate` if it is a real date, else `startDate`; anything undated sorts last.
- `distribute` puts each entry in the currently shortest column (height = sum of `1 / ratio`), ties to the left. Appending entries never moves earlier ones.

- [ ] **Step 1: Write the failing tests** in `src/data/works.test.ts`:

```ts
it('gives every listed project at least one valid offer', () => {
  for (const p of projects) expect(p.offers?.length, p.slug).toBeGreaterThan(0);
  for (const p of projects) for (const o of p.offers) expect(SLUGS, p.slug).toContain(o);
});
it('names any gallery piece still waiting for an offer', () => {
  expect(galleryItems.filter((i) => !i.offers?.length).map((i) => i.id)).toEqual([]);
});
it('points every workSlug at a real project', () => {
  for (const i of galleryItems) if (i.workSlug) expect(allProjects.map((p) => p.slug), i.id).toContain(i.workSlug);
});
it('lists projects and unlinked pieces together, newest first', () => {
  expect(workEntries.some((e) => e.kind === 'project')).toBe(true);
  expect(workEntries.some((e) => e.kind === 'piece')).toBe(true);
  expect(workEntries.filter((e) => e.kind === 'piece' && e.item.workSlug)).toEqual([]);
  const whens = workEntries.map((e) => e.when);
  expect(whens).toEqual([...whens].sort((a, b) => b - a));
});
it('filters by offer and by text', () => {
  const e = (id: string, offers: OfferSlug[], search: string) => ({ id, offers, search }) as WorkEntry;
  const list = [e('a', ['custom-maps'], 'silk road print'), e('b', ['remote-sensing'], 'fires europe'), e('c', [], 'untagged')];
  expect(filterEntries(list, 'remote-sensing', '').map((x) => x.id)).toEqual(['b']);
  expect(filterEntries(list, null, ' SILK ').map((x) => x.id)).toEqual(['a']);
  expect(filterEntries(list, null, '').map((x) => x.id)).toEqual(['a', 'b', 'c']);   // untagged still under All
});
it('reads only known offers from the URL', () => {
  expect(parseOffer('remote-sensing')).toBe('remote-sensing');
  expect(parseOffer('nonsense')).toBeNull();
  expect(parseOffer(null)).toBeNull();
});
it('fills the shortest column and never moves earlier entries', () => {
  const r = (ratio: number, id: number) => ({ ratio, id });
  const list = [r(1, 1), r(0.5, 2), r(1, 3), r(1, 4)];           // heights 1, 2, 1, 1
  expect(distribute(list, 2).map((col) => col.map((x) => x.id))).toEqual([[1, 3, 4], [2]]);
  expect(distribute(list.slice(0, 3), 2).map((col) => col.map((x) => x.id))).toEqual([[1, 3], [2]]);
});
```

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Add `offers` to all 34 projects and 58 gallery items, clean the gallery titles, set `workSlug` where a project's own page already shows the piece.** These are proposals for Alikhan to correct; list the uncertain ones in the final message. Add `"offers"` and `"workSlug"` to `EDITABLE` in `scripts/gallery.py` and to its `_note`.
- [ ] **Step 4: Implement `works.ts`.**
- [ ] **Step 5: Run `pnpm test`, `pnpm exec tsc --noEmit`.** Expected: pass.
- [ ] **Step 6: Commit.** "Tag works by offer and merge projects and gallery pieces into one list"

### Task 2: Cards and chips

**Files:** `Frame.tsx`, `WorkCard.tsx` (+ tests), `src/components/PieceCard/PieceCard.tsx` (+ test), `src/components/FilterChip/FilterChip.tsx` (+ test), `src/styles/system.css`

**Interfaces:**
- `FrameProps` gains `srcSet?: string` (overrides the manifest lookup) and `overlay?: ReactNode` (rendered inside the media box, above the image).
- `WorkCardProps` gains `ratio?: string`; the type line is `firstOfferLabel(project.offers)`.
- Produces:

```ts
export default function FilterChip(props: { pressed: boolean; onClick: () => void; children: ReactNode }): JSX.Element; // <button aria-pressed>
export default function PieceCard(props: { item: GalleryItem; onOpen: (item: GalleryItem) => void }): JSX.Element;
```

- `PieceCard` is a `<button>` (it opens the lightbox, it does not navigate). It shows a `Frame` with the piece's image or video poster at the entry ratio, a `play` icon for a video, the title and the first offer. On a fine pointer, with motion allowed and data saver off, hovering a video attaches its `preview` clip (`muted loop playsInline autoPlay preload="none"`); leaving removes it.

- [ ] **Step 1: Write the failing tests.** PieceCard: is a button and calls `onOpen(item)` on click; shows the title and first offer; a video shows the play icon and an image does not; a `pointerEnter` with `pointerType: 'touch'` attaches no `<video>`; with `(pointer: fine)` and `pointerType: 'mouse'` it attaches one whose `src` is the preview; with reduced motion it attaches none. FilterChip: `aria-pressed` follows `pressed`, click calls `onClick`. WorkCard: the type line is `Custom maps` for `offers: ['custom-maps', 'data-journalism']`. Frame: `srcSet` prop is used verbatim; `overlay` renders inside the media box.
- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `pnpm test`, `pnpm exec tsc --noEmit`.** Expected: pass.
- [ ] **Step 5: Commit.** "Add piece cards and filter chips"

### Task 3: The works index

**Files:** `src/pages/WorksPage.tsx` (rewrite, + test), `src/pages/works/WorksMapView.tsx` (moved code), `src/App.tsx`, `src/components/Footer/Footer.tsx`, `public/_redirects`, `vercel.json`, `scripts/prerender-routes.mjs`, `src/styles/global.css` (drop `.gallery-*`), deletions listed above.

**Behaviour:**
- h1 `Work`. One row: chips `All` and the five offer labels; a search field (`aria-label="Search works"`); a `Grid` / `Map` switch.
- Grid: `distribute(visible, columns)` with 1 column under 640 px, 2 under 1024, 3 above. The first 18 entries render; an observed sentinel adds 18 more each time it comes into view. Changing a filter resets to 18.
- Project entries render `WorkCard`, piece entries `PieceCard`. Opening a piece sets `?item=<id>` and shows the existing `Lightbox` over the visible pieces; closing removes the parameter.
- Nothing matches: the line `No works match.` and a quiet button `Clear filters`.
- Map: `WorksMapView` is `lazy()`; it receives the visible project entries. Its sidebar search is removed (the page's filters apply).
- `/gallery` redirects to `/works` in the router and at both hosts; the footer's interim Gallery link goes.

- [ ] **Step 1: Write the failing tests** (MemoryRouter with `initialEntries`): h1 is `Work`; six chips, `All` pressed by default; `/works?offer=remote-sensing` presses that chip and every rendered card's type line set includes only entries tagged with it (assert via count equal to `Math.min(18, filterEntries(...).length)`); `/works?offer=nonsense` behaves as `All`; `/works?q=zzzzzz` shows `No works match.` and `Clear filters` restores the grid; at most 18 cards render at first; `/works?item=<a real piece id>` renders a dialog and `/works?item=missing` does not; no `maplibre` module is imported until `Map` is chosen (mock `./works/WorksMapView` and assert the mock is not rendered in grid view).
- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Move the map view out, rewrite the page, wire redirects, delete the gallery page and its helpers.**
- [ ] **Step 4: Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm budget`.** Expected: pass; no `maplibre` chunk among the files `WorksPage-*.js` statically imports.
- [ ] **Step 5: Screenshots** of `/works` at 1440 and 375, one filtered, one with a piece open. Send them.
- [ ] **Step 6: Commit.** "Rebuild the works index around offers, with gallery pieces folded in"

### Task 4: The work page

**Files:** `src/pages/WorkDetailPage.tsx` (rewrite, + test), `ContactBand.tsx` (+ test), `src/styles/system.css`

**Interfaces:**
- `ContactBand` props: `{ heading?: string; line?: string; offer?: OfferSlug }`; with `offer` the button goes to `/contact?offer=<slug>`. `showContactBand` returns false for `/works/<slug>` (the page places its own band).
- `export function layoutFor(project: Project): 'full' | 'short'`: `full` only when `context`, `outcome` and at least one non-empty process step are all present.

**Behaviour:**
- Both layouts: h1 title, the tagline as one line, a plain facts list (Role, Year, Tools, Award when present; no pills, no stars), quiet links (`View live`, `View code`, both with `arrow-up-right`), the story callout when one exists.
- Full: the cover first, as a `Frame` at `16 / 9` with `viewTransitionName` `cover-<slug>` and `priority`; then Context, Idea, Design, Inspiration, Process (a numbered list), Outcome as plain h2 sections with body text; then videos, gallery, source note.
- Short: media first (gallery in its showcase layout, then videos); when there is no media, the cover `Frame`; then every text field the project has, as plain paragraphs under the h2 `About this work`.
- Then method notes when present, the band with heading `Work with me on something like this` and the project's first offer, and two more works.
- No atlas import.

- [ ] **Step 1: Write the failing tests.** `layoutFor` returns `full` and `short` for fixtures; an unknown slug renders the 404 heading; a full project renders h2s `Context` and `Outcome` and an image named `cover-<slug>`; a short project renders `About this work` and no `Context` h2; a project with no media and no text still renders the h1, a cover image and the band; the band link is `/contact?offer=<first offer>`; no `★` and no element with class `meta-pill` is rendered; `showContactBand('/works/silk-road')` is false and `showContactBand('/works')` is true.
- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm budget`.** Expected: pass.
- [ ] **Step 5: Screenshots** of one full and one short work page at 1440 and 375. Send them.
- [ ] **Step 6: Commit.** "Rebuild the work page with full and short layouts"

### Task 5: Walkthrough

- [ ] **Step 1:** Walk `/`, `/works`, three work pages, `/gallery` (must land on `/works`), `/journal`, `/about`, `/contact` at 1440 and 375. Expected: no console errors, no horizontal overflow.
- [ ] **Step 2:** Check that no headless browser process is left running.
- [ ] **Step 3:** Update the memory note for the redesign with what is done and what Alikhan must review (offer tags, piece titles, `workSlug` links).
