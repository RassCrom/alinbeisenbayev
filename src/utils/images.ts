import variantsData from '../data/image-variants.json';

/*
 * Responsive covers. scripts/prepare-images.py writes narrower WebP copies
 * next to each cover (cover.webp -> cover-w640.webp, cover-w1280.webp, ...)
 * and records which exist in image-variants.json; this turns an entry into a
 * srcset. A cover the script has not seen (or one too small to shrink) gets
 * no srcset and loads exactly as before.
 */

interface VariantEntry {
  width: number;
  variants: number[];
  og: string;
}

const manifest = variantsData as Record<string, VariantEntry>;

export function coverSrcSet(url: string): string | undefined {
  const entry = manifest[url];
  if (!entry || entry.variants.length === 0) return undefined;
  const base = url.replace(/\.[^./]+$/, '');
  return [
    ...entry.variants.map((width) => `${base}-w${width}.webp ${width}w`),
    `${url} ${entry.width}w`,
  ].join(', ');
}

/** `sizes` for the layouts covers appear in. Erring wide only costs bytes, never sharpness. */
export const COVER_SIZES = {
  /** Two-up grid card; also the three-up works grid. */
  card: '(min-width: 768px) 50vw, 100vw',
  /** Full-width bento card on the landing page. */
  cardWide: '(min-width: 1152px) 1104px, 100vw',
  /** Three-up story grid. */
  cardThird: '(min-width: 768px) 33vw, 100vw',
  hero: '100vw',
} as const;
