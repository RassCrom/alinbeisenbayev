import data from './gallery.json';
import type { GalleryItem } from '../types';

/*
 * Written by scripts/gallery.py from assets-src/gallery/ — run `npm run gallery`
 * after dropping new work there. The JSON also carries the script's bookkeeping
 * (source fingerprints), which the page ignores.
 */
export const galleryItems: GalleryItem[] = spreadSeries(
  (data.items as unknown as GalleryItem[]).filter((item) => !item.hidden),
);

/**
 * The manifest is newest first, which clusters a series (nine city videos
 * exported the same week) into one monotonous run. Keep roughly that order but
 * never put two works of one series side by side while something else is
 * still waiting to go in between.
 */
function spreadSeries(items: GalleryItem[]): GalleryItem[] {
  const queue = [...items];
  const out: GalleryItem[] = [];
  while (queue.length) {
    const previous = out[out.length - 1]?.series;
    const next = queue.findIndex((item) => !item.series || item.series !== previous);
    out.push(...queue.splice(next === -1 ? 0 : next, 1));
  }
  return out;
}

/** The script writes <name>-w480.webp etc. next to each image; this lists them. */
export function gallerySrcSet(item: GalleryItem): string | undefined {
  if (item.kind !== 'image' || !item.variants?.length) return undefined;
  const base = item.src.replace(/\.webp$/, '');
  return [
    ...item.variants.map((width) => `${base}-w${width}.webp ${width}w`),
    `${item.src} ${item.width}w`,
  ].join(', ');
}
