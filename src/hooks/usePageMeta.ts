import { useEffect } from 'react';

const SITE_NAME = 'Alikhan Beisenbayev';
const SITE_TITLE = `${SITE_NAME} — Cartographer & GIS Engineer`;

/** Kept in sync with the <meta name="description"> fallback in index.html. */
const SITE_DESCRIPTION =
  'Award-winning cartographer and GIS engineer. Print maps, scroll-driven map narratives, and interactive geospatial work on climate, history and Central Asia.';

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
export function usePageMeta(title?: string | null, description?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE_NAME}` : SITE_TITLE;
    setDescription(description || SITE_DESCRIPTION);
  }, [title, description]);
}
