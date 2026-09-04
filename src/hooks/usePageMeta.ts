import { useEffect } from 'react';

const SITE_NAME = 'Alikhan Beisenbayev';
const SITE_TITLE = `${SITE_NAME} — Cartographer & GIS Engineer`;

/** Kept in sync with the <meta name="description"> fallback in index.html. */
const SITE_DESCRIPTION =
  'Award-winning cartographer and GIS engineer. Print maps, scroll-driven map narratives, and interactive geospatial work on climate, history and Central Asia.';

/**
 * A client-rendered 404 still answers HTTP 200 — the SPA rewrite serves
 * index.html for every path — so a crawler has no status code to go on and
 * would index the miss as a real page. `noindex` is the standard way to tell
 * it otherwise. Removed again on every other route.
 */
function setRobots(noindex: boolean): void {
  const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!noindex) {
    existing?.remove();
    return;
  }
  const tag = existing ?? document.createElement('meta');
  tag.name = 'robots';
  tag.content = 'noindex, follow';
  if (!existing) document.head.appendChild(tag);
}

function setDescription(content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/**
 * Per-route <title> and description.
 *
 * Routing swaps the view without touching the document head, so every page
 * otherwise shares the one title baked into index.html — which makes open tabs
 * and browser history unreadable, and gives every indexed route the same name.
 *
 * `title` is the page's own name; the site name is appended here so callers
 * don't repeat it. Pass nothing for the landing page, which is the site title.
 * og: tags are deliberately not touched — unfurlers read the served HTML and
 * never run this, so mutating them at runtime would only look like it worked.
 */
export function usePageMeta(
  title?: string | null,
  description?: string | null,
  options?: { noindex?: boolean; enabled?: boolean },
): void {
  const noindex = options?.noindex ?? false;
  /*
   * `enabled: false` makes this a no-op, for a route that hands its render to
   * another page which sets its own head. React flushes child effects before
   * parent ones, so without this the parent runs *last* and overwrites what the
   * child just set — which is how /works/<unknown-slug> ended up rendering the
   * 404 sheet under the site's own title with no noindex.
   */
  const enabled = options?.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    document.title = title ? `${title} — ${SITE_NAME}` : SITE_TITLE;
    setDescription(description || SITE_DESCRIPTION);
    setRobots(noindex);
  }, [title, description, noindex, enabled]);
}
