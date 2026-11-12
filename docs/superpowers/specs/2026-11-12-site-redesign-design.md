# Site redesign: flat with depth

Date: 2026-11-12. Status: approved by Alikhan on 2026-11-12, with Claude's
recommended answers to the open questions (recorded at the end).

Lines marked **(my call)** are choices Claude made that Alikhan has not
confirmed. Everything else comes from his brief or his answers.

## Intent

The site is still a portfolio, but its job changes: a visitor sees the work
itself, large, and is led to one action, "Work with me". The mood is cozy and
atmospheric. Depth and motion carry that mood; there is no 3D scene to learn.

Why now: the current site reads as a recruiter document (Connect says "Open to
job offers"), spreads content over seven nav items, and its home page (the
atlas) needs an explainer, a finder and a tour.

## Goals

- Work is shown first and large. Text supports it.
- One call to action, visible on every page, ending in a form filled in on the
  site.
- The five offers are named on the home page and each leads to works that
  prove it.
- A new design system replaces the current tokens and shared classes.
- Smooth, useful motion: hover depth, page transitions, loading and form
  feedback.
- The works index stays fast as it grows well past today's 34 projects and 58
  gallery pieces.
- Light pages with working fallbacks on weak devices.

## Non-goals

- A second language. English only.
- A light theme. One dark theme ships; tokens are named so a second can be
  added as one override block later.
- New case-study writing, a CMS, a pricing page, analytics.
- Re-encoding the whole video library. Only what the budgets below require.

## Anti-goals

The redesign has failed, even if it works, when any of these is true:

- A visitor needs an instruction to use a page.
- An effect makes a work smaller, dimmer or slower to appear.
- A badge, label or number is there to fill space.
- Motion delays reading. Nothing blocks content for more than 400 ms.
- WebGL runs on the home page.

## Approaches considered

1. **Relief hero.** One terrain scene behind the headline, depth elsewhere.
   Sets a strong mood, costs one WebGL scene and its fallbacks.
2. **Work table.** Prints on a lit desk as the navigation. Most memorable,
   but works appear small and angled and the mockup already needed a "drag to
   move" hint.
3. **Flat with depth.** No scene. Covers stacked in perspective, tilt on
   hover, a cover that grows into its page.

Alikhan picked **3** after seeing still mockups of all three. It is the
lightest, has trivial fallbacks, and keeps every pixel of 3D attached to a
real work.

## Site map

| Route | Page | Replaces |
|---|---|---|
| `/` | Home | Atlas and landing page |
| `/works` | Works index | Works and Gallery |
| `/works/:slug` | Work page | same |
| `/journal` | Journal index | Stories and Blog |
| `/journal/:slug` | Journal entry | `/stories/:slug`, `/blog/:slug` |
| `/journal/map-awards` | Map Awards Calendar | `/blog/map-awards` |
| `/about` | About | About, plus the links from Connect |
| `/contact` | Work with me | Connect |

Nav: name on the left, `Work`, `Journal`, `About` in the middle, the
`Work with me` button on the right. Three links and one button, on every page.

Redirects, both in the router and at the host (`public/_redirects` and
`vercel.json`, which are kept in sync today):

- `/stories` and `/blog` to `/journal`; `/stories/:slug` and `/blog/:slug` to
  `/journal/:slug`. No slugs collide today.
- `/gallery` to `/works`, `/connect` to `/contact`, `/skills` to `/about`.

`scripts/prerender-routes.mjs` and the sitemap follow the new routes.

## Removed

- **Skills**: page, route, `skills.json`, its images.
- **Gallery page**: its pieces move into the works index (below).
- **Atlas**: no longer the home page. **(my call)** Delete `src/atlas`,
  `public/atlas` and the `atlas:print` script from this branch; the work
  survives on the `experiment-map` branch and in history.
- **Light theme**, the theme toggle and the pre-paint theme script.
- **Custom cursor**, the "experimental" tag, language pills, coordinate
  labels, and every use of the `mono-label` style (31 call sites).
- **Telegram and YouTube feed** on the blog page (12 Telegram posts, in
  Russian). **(my call)** The footer links to the channels instead.

## Design system

One file of tokens, one small set of components. Nothing on the site styles
itself outside them.

### Colour

One dark theme, working name Lamp. Contrast ratios are measured against the
three backgrounds in order.

| Token | Value | Use | Contrast on bg / surface / raised |
|---|---|---|---|
| `bg` | `#14110f` | page | |
| `surface` | `#1c1815` | frames, cards | |
| `raised` | `#26201b` | hover, overlays, fields | |
| `line` | `#3a3028` | dividers only, never text | |
| `text` | `#f3ebdf` | headings, body | 15.9 / 14.9 / 13.6 |
| `text-2` | `#b9ac99` | secondary text | 8.4 / 7.9 / 7.2 |
| `text-3` | `#948672` | captions, placeholders | 5.3 / 5.0 / 4.5 |
| `accent` | `#f0823c` | the CTA, focus, active state | 7.1 / 6.7 / 6.1 |
| `accent-ink` | `#1d0f06` | text on accent | 7.1 on accent |

Accent rule: the solid accent fill belongs to "Work with me" and the form's
submit button, nowhere else. Other uses are outlines, focus rings and active
filter state.

Translucent chrome uses `color-mix()` on these tokens instead of the old
`-rgb` triplet tokens. **(my call)**

### Type

Geologica only (already self-hosted). No mono, no italics, no uppercase
letter-spaced labels.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Display | clamp 40 to 76 px | 600 | line-height 1.02, tracking -0.03em |
| H2 | clamp 28 to 40 px | 600 | |
| H3 | 22 to 26 px | 550 | |
| Body | 18 px | 350 | line-height 1.55, max 68 characters |
| Small | 16 px | 350 | smallest size on the site is 15 px |

### Space, radius, depth

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 72, 96, 140. Related things sit 8
  to 24 apart, groups 72 or more. Grouping is done with space, not boxes or
  rules.
- Radius: inner = outer minus padding. Frame 20 outer, 8 padding, 12 inner.
  Small frame 12, 4, 8. Buttons and chips are pills.
- Depth has three tiers, each one shadow token: resting frame, lifted (hover
  or focus), overlay (lightbox, menu). No glows, gradients or borders used as
  decoration.

### Icons

One set: 20 px box, 1.6 stroke, round caps and joins, `currentColor`, drawn as
local SVG components (about twelve: arrows, menu, close, play, search, check,
mail). Social marks are redrawn as single-colour glyphs in the same box
instead of the current image files. **(my call)** No icon library dependency.

### Components

Button (primary, quiet), text link with icon, Frame (the padded image
holder), WorkCard, JournalCard, FilterChip, Field (input, textarea, chip
group), Skeleton, Nav, Footer, ContactBand, Lightbox (existing, restyled).

### Motion

CSS and the Web Animations API only; no animation library. **(my call)**

| Token | Value | Use |
|---|---|---|
| press | 120 ms | button and chip press |
| hover | 200 ms | lift, tilt settle, colour |
| enter | 400 ms | content arriving |
| page | 600 ms | cover growing into its page |
| ease | `cubic-bezier(0.2, 0.8, 0.2, 1)` | everything |

- **Tilt**: a hovered card follows the pointer, at most 6 degrees, and lifts
  one depth tier. Fine pointers only.
- **Hero stack**: three covers at different depths, tilted about 20 degrees.
  They shift a few pixels with the pointer and flatten as the page scrolls.
- **Page transition**: opening a work grows its cover into the work page's
  hero through the View Transitions API. Other navigations cross-fade.
  Unsupported browsers navigate instantly.
- **Filtering**: cards that stay move to their new place; cards that leave
  fade.
- **Feedback**: press states, field validation, submit progress, a clear sent
  state.
- `prefers-reduced-motion`: no tilt, no drift, no growing cover; cross-fades
  only.

### Loading states

- Every image and video has its aspect ratio reserved from the width and
  height already in the data, so nothing shifts.
- Frames show a quiet skeleton, then fade the image in.
- Route changes show a skeleton shaped like the page that is coming, not the
  word "Loading".
- Video is poster first and never preloads.

### Copy rules

- Headlines say what the thing is. "Selected work", not a slogan.
- One short line under a title at most. No taglines stacked on taglines.
- Labels appear only where the thing is not self-evident.
- Numbers are real and sourced from the data, or absent.

## Pages

### Home

1. **Hero.** Headline, one line naming the offers, `Work with me`, and a
   quiet "See the work" link. To the right, the stack of three real covers.
   On phones the stack sits under the text, flatter.
2. **Selected work.** The first featured work spans the full width; the rest
   follow two per row. Title and one plain-text type line each.
3. **Offers.** One row of five links. Each opens the works index filtered to
   that offer.
4. **Journal.** The three newest entries.
5. **Contact band**, then the footer.

Headline in the mockup is Alikhan's own tagline, shortened: "Maps that show
what data alone cannot." **(my call)**

The hero stack and the selected-work order both come from the existing
`featured` and `featuredOrder` fields: the first three featured works make
the stack. **(my call)**

On phones the nav shows the name, the `Work with me` button and a menu icon;
the three links open in a sheet.

### Works index

- Projects (34) and gallery pieces (58) in one grid, as two kinds of entry:
  a **project** opens its page; a **piece** opens in the lightbox with its
  title, and has a shareable address (`/works?item=<key>`).
- One row of filter chips, by offer, plus the existing keyword search. Filter
  state lives in the URL.
- Every entry needs an `offers` field. Claude proposes tags for all 92;
  Alikhan corrects them in one pass over the JSON. The offer filter is in
  the address as `/works?offer=<slug>`, and a card's type line is its first
  offer.
- Gallery titles were generated from file names ("Seriea 2026 27 Title
  Chances"). Claude proposes readable titles in the same pass.
- Built for growth: cards outside the viewport are skipped by the browser
  (`content-visibility`), images are lazy and sized per column, and the grid
  renders in batches as the visitor scrolls.
- Videos show their poster, play their short preview on hover or when tapped,
  and never autoplay on phones or with data saver on.
- The works map (MapLibre, about 1 MB of script) leaves the default view.
  **(my call)** It stays behind a "Map" switch on this page and loads only
  when chosen.

### Work page

- Hero is the cover at full width, the same element that grew from the card.
- Title, one line, then a plain row of facts (role, year, tools).
- **Full layout** when the project has context, process and outcome text.
  **Short layout** otherwise: media, one paragraph, links. This replaces
  today's rule, where a single filled field triggers the full layout and thin
  entries look unfinished.
- Ends with "Work with me on something like this", which opens the form with
  that work's offer preselected.

### Journal

- One index for stories, method notes and the Map Awards Calendar. Entries
  carry a plain-text kind (Story, Note, Tool) shown once on the card.
- Entry pages keep the existing MDX pipeline, chapter nav and cross-links to
  works. External stories keep their "Read the story" link.
- Map Awards keeps its behaviour; it takes the new tokens and the new address
  only.

### About

- Photo, the story, proof (awards from the project data, audience numbers
  with their dates), the full list of profiles that Connect used to hold, and
  the CV download.
- The globe story stays, recoloured to the new palette. **(my call)** It is
  lazy-loaded and not on the home page.

### Work with me (`/contact`)

- Heading, two or three plain lines on what happens next, and the form.
- Fields: name, email, what you need (the five offers as chips, optional,
  several allowed), message. Four fields, no more.
- States: idle, sending, sent (the form is replaced by a confirmation that
  repeats what was sent), failed (input kept, direct email shown).
- Spam: a hidden honeypot field, a minimum fill time, and length checks in
  the database. A challenge widget is added only if spam appears.
- Delivery: a Supabase `inquiries` table that visitors can insert into and
  nobody can read through the public key, following the pattern already used
  for award submissions. A Supabase function then notifies Alikhan. See open
  question 2 for the channel.
- If the Supabase variables are missing, the form falls back to opening the
  visitor's mail app with the message filled in.

### Footer

- A custom line illustration of a cartographer working in the field, drawn
  as SVG in the same stroke as the icons, with one accent detail. It sits in
  two or three layers that shift slightly on scroll, and is still under
  reduced motion. Claude drafts it and sends it for approval before it goes
  in.
- Under it: name, the three nav links, social glyphs, email, year.

### Shared

- The contact band (one line and the `Work with me` button) sits above the
  footer on every page except `/contact` and the full-screen Map Awards page,
  which has no footer today either.
- The 404 page takes the new system and offers the three nav links.

## Weight and fallbacks

Budgets, checked on the built site with a throttled phone profile:

| Measure | Budget |
|---|---|
| Home, script before interaction | 90 KB gzipped |
| Home, styles | 20 KB gzipped |
| Home, largest image | 150 KB |
| Home, total before scrolling | 500 KB |
| Largest contentful paint | under 2.5 s |
| Layout shift | under 0.05 |
| Lighthouse performance, phone | 90 or more on Home and Works |

How they are met:

- Atlas script, styles and its 2.2 MB of images are gone.
- MapLibre loads only on the works map switch, the globe and Map Awards.
- Covers are served in AVIF and WebP at three widths through the existing
  `image-variants.json` pipeline.
- Fonts: Latin and Latin Extended subsets only, if no Cyrillic remains on the
  site once the Telegram feed is gone.

Fallbacks:

- No CSS 3D or a coarse pointer: cards and the hero stack are flat; nothing
  is hidden.
- No View Transitions: instant navigation.
- Data saver or a slow connection: no video previews.
- No JavaScript: the prerendered head still gives every page its title and
  share card, as today.

## Order of work

Each step leaves the site working, and ends with screenshots (desktop and
phone width) sent to Alikhan, who follows from another device.

1. Tokens, components, nav, footer shell, loading states. Old pages keep
   running on the new tokens.
2. Home.
3. Works index (with gallery pieces) and work pages.
4. Journal, with redirects.
5. About and the contact form.
6. Footer illustration.
7. Removals, redirects at the host, prerender script, weight pass against the
   budgets.

Branch: a new `redesign` branch. The working tree currently has uncommitted
changes that move the site to Geologica; they should be committed first, as
the redesign builds on them.

## Left to the builder

- How the cover-to-page transition is wired into React Router 6. The site
  uses `BrowserRouter`; the router's built-in view-transition support needs
  the data router.
- Exact shadow values, skeleton styling, breakpoints.
- Whether batching in the works grid needs more than `content-visibility`
  and lazy images at 92 entries.
- File layout for tokens and components.

## Answers to the open questions

Approved 2026-11-12 with the recommended answers:

1. **The five offers**: Custom maps, Spatial analysis, Data visualization,
   Data journalism, Remote sensing. Slugs: `custom-maps`,
   `spatial-analysis`, `data-visualization`, `data-journalism`,
   `remote-sensing`.
2. **Inquiries** arrive by email through a sending service (Resend), and are
   also stored in Supabase. Alikhan creates the account when the form step
   starts.
3. **The atlas** is deleted from the redesign branch; it stays on
   `experiment-map`.
4. **Which host is live** is still unknown and is needed before the form
   step, not before.
