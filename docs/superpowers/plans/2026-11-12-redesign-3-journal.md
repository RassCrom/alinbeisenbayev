# Redesign Plan 3: Journal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Journal at `/journal` that holds the published stories, the method notes from the blog and the Map Awards Calendar, with every old address redirecting.

**Architecture:** A data module merges `stories.json`, the blog posts' frontmatter and one hand-written tool entry into a list of `JournalEntry`. It reads frontmatter only, so the index and the home page never load a post's body. One entry page renders a story or a note; the Map Awards page keeps its own route under the new address.

**Tech Stack:** as plans 1 and 2. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-12-site-redesign-design.md` (sections "Site map", "Journal", "Removed")

## Global Constraints

All of plan 1's and plan 2's constraints apply. In addition:

- Addresses: `/journal`, `/journal/<slug>`, `/journal/map-awards`. Kind filter: `/journal?kind=story|note|tool`.
- Redirects in the router and at both hosts: `/stories` and `/blog` to `/journal`; `/stories/<slug>` and `/blog/<slug>` to `/journal/<slug>`.
- An entry's kind is shown once, as plain text: `Story`, `Note` or `Tool`.
- The Telegram and YouTube feed is removed with its data and media.
- The Map Awards page changes address only; its behaviour is untouched.

## Review Focus

1. **A story and a note with the same slug.** They would share one address. The data test fails and names the slug. Test in Task 1.
2. **An in-repo story whose `.mdx` body is missing.** The page falls back to the "Read the story" link instead of an empty page. Test in Task 3.
3. **A draft or hidden post.** It appears nowhere: not in the index, not by address. Test in Tasks 1 and 3.
4. **An old deep link with a hash or query** (`/stories/saint-lucia#sources`). The redirect keeps both. Test in Task 4.
5. **`?kind=` with an unknown value.** Treated as All. Test in Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `src/content/notes-meta.ts` | blog posts' frontmatter without their bodies (new) |
| `src/data/journal.ts` | `JournalEntry`, the merged list, kind parsing (new) |
| `src/components/JournalCard/JournalCard.tsx` | gains `summary`, `date` and a `lead` size (modify) |
| `src/components/ChapterNav/ChapterNav.tsx` | rebuilt on the new system (rewrite) |
| `src/pages/JournalPage.tsx` | the index (new) |
| `src/pages/JournalEntryPage.tsx` | a story or a note (new) |
| `src/components/LegacyRedirect/LegacyRedirect.tsx` | old address to new, keeping slug, query and hash (new) |
| Deleted | `StoriesPage`, `StoryDetailPage`, `BlogPage`, `BlogPostPage`, `StoryCard`, `src/data/blog.json`, `public/telegram_media/`, the blog feed types |

---

### Task 1: The merged list

**Interfaces:**

```ts
// src/content/notes-meta.ts
export const noteMeta: { slug: string; frontmatter: ArticleFrontmatter }[]; // drafts and hidden posts left out

// src/data/journal.ts
export type JournalKind = 'Story' | 'Note' | 'Tool';
export interface JournalEntry {
  slug: string; title: string; summary: string; cover: string;
  kind: JournalKind;
  date: string;      // for display: "November 2026" or "7 August 2026"
  when: number;      // sortable, larger is newer
  href: string;      // `/journal/${slug}`
}
export const journalEntries: JournalEntry[];                 // newest first
export function parseKind(value: string | null): JournalKind | null; // 'story' | 'note' | 'tool', any case
```

- The tool entry: slug `map-awards`, title `Map Awards Calendar`, cover `/images/blog/map-awards/cover.jpg`, date `2026-11`, summary `Every cartography, GIS and data visualization award on one map, with deadlines, prizes and a calendar feed.`
- A note with no cover uses `/images/placeholder.jpg`.

- [ ] **Step 1: Write the failing tests** (`src/data/journal.test.ts`): slugs are unique; `when` is descending; every `href` is `/journal/<slug>`; one entry per story in `stories`; `stockholm-metro-guide` is a `Note`; `getting-started` (a draft) is absent; exactly one `Tool`, slug `map-awards`; `parseKind('NOTE')` is `'Note'`, `parseKind('x')` and `parseKind(null)` are null.
- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Implement both modules.**
- [ ] **Step 4: Run `pnpm test`, `pnpm exec tsc --noEmit`.** Expected: pass.
- [ ] **Step 5: Commit.** "Merge stories, notes and the awards tool into one journal list"

### Task 2: The index

**Behaviour:** h1 `Journal`. Chips `All`, `Stories`, `Notes`, `Tools` (group label `Filter by kind`), state in `?kind=`. The newest visible entry is a lead card across the full width with its summary; the rest follow three per row from 1024 px, two from 640 px. Each card: cover, title, one line `<kind>, <date>`. An empty filter shows `Nothing here yet.`

`JournalCardProps` gains `summary?: string`, `date?: string`, `size?: 'lead' | 'third'`.

- [ ] **Step 1: Write the failing tests:** h1; four chips with `All` pressed; card count equals `journalEntries.length`; `?kind=note` shows only notes and presses `Notes`; `?kind=nonsense` behaves as All; the first card shows its summary and the others do not; pressing `Tools` shows one card linking to `/journal/map-awards`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `JournalPage` and extend `JournalCard`.** The home page's Journal section switches to `journalEntries.slice(0, 3)`.
- [ ] **Step 4: Run tests and type check.** Expected: pass.
- [ ] **Step 5: Commit.** "Build the journal index"

### Task 3: The entry page

**Behaviour, both kinds:** cover `Frame` at `16 / 9` (priority), h1, the summary as one line, a plain meta line, the body, then two more entries and the standard contact band.

- **Story:** meta line `By <authors>, <date>`. In-repo with a body: `ChapterNav` and the body in `.mdx-prose`. Otherwise a quiet `Read the story` button (new tab when external). `How it was made` links to `/works/<workSlug>` when set. Method notes link to `/journal/<slug>`. A facts list: Published, Authors, Format, Subjects, Sources, Award, and `Reads at` for an external piece.
- **Note:** meta line `By Alikhan Beisenbayev, <date>, <n> min read` (reading time measured from the rendered body). `ChapterNav`, the body, then the related work as a `WorkCard` and the related story as a `JournalCard`.
- Unknown slug, draft or hidden post: the not-found page.
- `ChapterNav`: a `--surface` box titled `On this page`, plain links, the current chapter in `--text` with an accent marker. No zero-padded numbers.

- [ ] **Step 1: Write the failing tests:** an in-repo story (`saint-lucia`) renders its h1, a body and no `Read the story` link; an external story (`tigranes-the-greatest`) renders `Read the story` with the story's `url` and `target="_blank"`, and `How it was made` to `/works/tigranes-the-greatest`; the note (`stockholm-metro-guide`) renders its h1 and a work card to `/works/metro-animation`; `getting-started` and `no-such-entry` render the not-found heading; no `★`, no `.meta-pill`; every `/blog/` or `/stories/` link is gone from the rendered page; `ChapterNav` lists every `h2[id]` when there are two or more and nothing when there is one.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `JournalEntryPage` and rewrite `ChapterNav`.**
- [ ] **Step 4: Run tests and type check.** Expected: pass.
- [ ] **Step 5: Commit.** "Build the journal entry page"

### Task 4: Routes, redirects, removals

- `App.tsx`: `/journal`, `/journal/map-awards` (before `/journal/:slug`), `/journal/:slug`; `LegacyRedirect` on `/stories`, `/stories/:slug`, `/blog`, `/blog/:slug`.
- `LegacyRedirect({ to })`: replaces the address with `to` (plus `/<slug>` when the route has one), keeping `location.search` and `location.hash`.
- Links: `stories.json` in-repo `url`s, `utils/ics.ts` `AWARDS_PAGE_PATH`, `MapAwardsPage`'s back link, `NotFoundPage`, `WorkDetailPage` method notes, `StoryCallout`'s target, the footer's interim Blog link (removed), `ContactBand` and `App` full-screen checks.
- Hosts and prerender: redirects in `public/_redirects` and `vercel.json`; `scripts/prerender-routes.mjs` emits `/journal` and `/journal/<slug>` heads.
- Delete the pages, `StoryCard`, `blog.json`, `public/telegram_media/`, `BlogData` / `BlogPost` types and the `.clamp-3` rule if nothing uses it.

- [ ] **Step 1: Write the failing tests:** `LegacyRedirect` sends `/stories/saint-lucia?x=1#sources` to `/journal/saint-lucia?x=1#sources`, `/blog/map-awards` to `/journal/map-awards`, `/blog` to `/journal`; the footer has no `Blog` link; `showContactBand('/journal/map-awards')` is false.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement, relink, delete.** `grep -rn "'/stories\|/blog/" src scripts` returns only redirect routes and image paths under `/images/blog/`.
- [ ] **Step 4: Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm budget`.** Expected: pass.
- [ ] **Step 5: Screenshots** of `/journal`, one story, the note and `/journal/map-awards` at 1440 and 375; check `/stories/saint-lucia` and `/blog` land on the new addresses. Send them. Check no browser process is left.
- [ ] **Step 6: Commit.** "Move stories and blog under /journal and redirect the old addresses"
