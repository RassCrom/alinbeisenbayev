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

const LABELS = new Map(OFFERS.map((offer) => [offer.slug, offer.label]));

/** An offer's display label, or '' for a slug nobody knows. */
export function offerLabel(slug: OfferSlug | undefined): string {
  return (slug && LABELS.get(slug)) ?? '';
}

/** A card's one type line: the label of its first offer, or nothing. */
export function firstOfferLabel(offers: OfferSlug[]): string {
  return offerLabel(offers[0]);
}

/** The `?offer=` value, if it names a real offer. */
export function parseOffer(value: string | null): OfferSlug | null {
  return OFFERS.find((offer) => offer.slug === value)?.slug ?? null;
}
