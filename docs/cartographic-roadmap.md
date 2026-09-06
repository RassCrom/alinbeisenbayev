# Making the portfolio read as a map sheet

Ideas for pushing the site from "dark portfolio with map flavour" to "a
cartographic document you navigate", ordered from an afternoon's work to a
multi-week feature. Each item says what it is, why a recruiter for a data
journalism or visual story role would notice it, and roughly what it costs.

The frame throughout: the site is an **atlas**. The works index is the
**sheet index**, each project is a **sheet**, the About page is the
**cartouche**, and the reader moves between them the way you move across a
folded map: by neatline, grid reference, locator inset and margin notes.

What is already in place after this pass: sheet numbering and a running head
on every work ("Sheet 03 / 29 · Print / static map · 2025"), a title block of
facts under the title, the source note in the margin, the locator inset, the
graduated hub symbols on the works map, the 404 as an unsurveyed sheet, and
the cursor coordinate readout.

---

## Small — an hour or two each

1. **Neatline on the detail hero.** A double rule around the cover image with
   tick marks at the corners, the way a printed sheet is framed. Pure CSS
   (`outline` + `outline-offset` plus four absolutely positioned corner
   ticks). Immediately reads as "map", costs nothing at runtime.

2. **Grid references on the sheet index.** Give each card a reference like
   `C-4` derived from its grid position, in the plate-number slot the landing
   cards already have. The works page then has "find sheet C-4" language
   available for the map ↔ list link.

3. **Scale bar in the footer.** A small SVG scale bar whose label reads the
   page's approximate real-world scale at the current zoom of the works map,
   or a fixed joke value elsewhere ("1 : 1 at this size"). One component,
   one prop.

4. **Compass rose on the works map.** MapLibre's NavigationControl already
   exists; replace the compass with a drawn rose that rotates with bearing.
   Needs `showCompass: true` plus a custom control element.

5. **Magnetic declination line in the About cartouche.** The About page
   profile block gains one line of marginalia: "Declination 5°E (2026),
   changing 0.1°E per year" using real values for Vienna. Playful, on-brand,
   one string.

6. **Sheet edition and revision date.** Every detail page footer:
   "Edition 2 · Revised Jun 2026". Sourced from git: a build script writes
   each project's last-commit date into a JSON map. Recruiters read this as
   "maintained".

7. **Contour-interval eyebrow on prose sections.** Replace the plain accent
   bar before each section eyebrow with three short parallel lines at
   decreasing opacity, a contour interval. CSS only.

8. **Coordinates in the meta pills.** The card's year pill is the only
   number on it. Add the primary mapped place's coordinate beneath the
   tagline on hover, in the mono label style the map already uses.

## Medium — a day or two each

9. **A map key for the whole site.** A `/legend` route (or a slide-over from
   the nav) that explains every symbol the site uses: blue hub dot, gold
   subject dot, dashed arc, star for awards, the in-progress badge. Written
   as a legend, in legend layout. Links each symbol to where it is used. For
   a recruiter this doubles as a "how to read this portfolio" page.

10. **Sheet-to-sheet navigation by geography.** On a detail page, "Adjoining
    sheets" currently ranks by keyword. Add a second row: the two works whose
    mapped places are geographically nearest, with the great-circle distance
    printed ("Samarkand → Almaty, 1 020 km"). `contextLatLng` and the
    orthographic helpers already give the maths.

11. **Locator inset that opens the works map.** The inset in the source note
    is a static canvas. Make it a link to `/works?view=map&focus=<slug>`, and
    have the works map accept `focus` to fit and light that project's arcs.
    The reader goes from a sheet to its place in the atlas in one click.

12. **Hover to preview the mapped place on the works map.** Hovering a card in
    the grid shows a tiny orthographic inset (same component as the locator)
    in the card corner, centred on the project's subject. Cheap because the
    canvas is 90 px and draws once.

13. **Chapter markers as a strip map.** For case-study pages, replace the
    numbered process timeline with a horizontal strip map: each step is a
    station on a route, with the connector drawn as a road casing (dark line,
    lighter inner line). Same data, new CSS, and it looks like the metro
    animations the site already shows.

14. **A "read this sheet" progress line.** A thin vertical bar at the page
    edge showing reading progress as a graticule: ticks every 10 %, filled
    like a scale bar. Replaces the generic scroll-reveal as the motion cue.
    IntersectionObserver plus one fixed element.

15. **Typographic hierarchy from real sheets.** Titles in the heading face,
    but subtitles in small caps with letter-spacing, place names in italic,
    numbers in tabular figures. Most of the tokens exist; this is a pass over
    `global.css` to apply them consistently, then a screenshot audit.

## Large — a week or more

16. **The atlas as the landing page.** Replace the hero-plus-grid landing with
    a single full-viewport orthographic globe (the canvas projection already
    exists, no WebGL) with the five hub cities and the mapped places drawn on
    it. Scrolling rotates the globe from Astana to Vienna and reveals the
    featured works as sheets pinned to their places. The About page's story
    scroll is the prototype for this.

17. **A sheet index that is a real index map.** Instead of the grid, an index
    map in the style of a national mapping agency: a rectangle grid over the
    world, each cell numbered, cells with works shaded, click a cell to open
    the sheets in it. The grid is the current card grid re-projected; the
    hard part is making it work on a phone.

18. **Editions.** Version each project's data in git and let a reader open a
    previous edition of a sheet: "Edition 1 (Apr 2025)" showing the earlier
    cover, caption and outcome. Data journalists care about revision
    history; this shows it as a product feature. Needs a build step that
    snapshots project JSON per tag.

19. **Print view of a sheet.** A `@media print` stylesheet plus a "Print this
    sheet" action that lays the detail page out as an actual A3 map sheet:
    cover as the map body, title block top-right, source note bottom-left,
    locator bottom-right, neatline. A recruiter can save a PDF of any work.
    Mostly CSS, but every component needs checking.

20. **Server-rendered sheets.** The site is client-rendered, so every shared
    link unfurls as the homepage and crawlers see an empty root. A
    prerender step (vite-plugin-prerender or a small Puppeteer script over
    the sitemap) gives each sheet its own social card with the cover image
    and tagline. This is the single biggest change for how the work travels
    when the link is pasted into a hiring channel.

---

## Content, not code

Things a recruiter would trip over that no component can fix:

- Fourteen of the twenty-nine works have no written case study. The page
  handles that gracefully now, but "Sole author · May 2026 · social media"
  under an image is not a story. Two sentences of context and one of outcome
  per work would promote each one to the full layout automatically.
- "Gained 4 likes in 4 hours on LinkedIn :(" is the Outcome of Tropical
  Night. It is honest and funny in person; on a page a hiring manager skims
  it reads as the project having failed. Either remove the outcome or state
  what the map showed.
- Awards are the strongest signal on the site and only four works carry
  them. Featured or published elsewhere (GeoHipster, the Atlas of
  Sustainability) is recorded as an award, which is right. Publications,
  talks and press for the other works belong in the same field.
- The tagline is the sentence a recruiter reads. Several are descriptions of
  the artefact ("Print map showcasing…") rather than the finding. A data
  journalism reader wants the finding: "Kazakhstan's fires cluster in three
  belts and start three weeks earlier than in 2001."
