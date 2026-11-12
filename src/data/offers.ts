/** What Alikhan can be hired for. The order is the order they are shown in. */
export type OfferSlug =
  | 'custom-maps'
  | 'spatial-analysis'
  | 'data-visualization'
  | 'data-journalism'
  | 'remote-sensing';

export interface Offer {
  slug: OfferSlug;
  label: string;
}

export const OFFERS: readonly Offer[] = [
  { slug: 'custom-maps', label: 'Custom maps' },
  { slug: 'spatial-analysis', label: 'Spatial analysis' },
  { slug: 'data-visualization', label: 'Data visualization' },
  { slug: 'data-journalism', label: 'Data journalism' },
  { slug: 'remote-sensing', label: 'Remote sensing' },
];

/** The works index, filtered to the works that prove an offer. */
export function offerHref(slug: OfferSlug): string {
  return `/works?offer=${slug}`;
}
