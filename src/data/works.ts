import { galleryItems } from './gallery';
import { OFFERS, firstOfferLabel, offerLabel, type OfferSlug } from './offers';
import { projects } from './projects';
import type { GalleryItem, Project } from '../types';

/**
 * One thing on the works index. A `project` has a page of its own; a `piece`
 * is a finished image or animation that opens in the lightbox.
 */
export type WorkEntry = {
  id: string;
  title: string;
  offers: OfferSlug[];
  /** The image the card shows: a project's cover, a piece's image, or a video's poster. */
  cover: string;
  /** Width over height the card reserves. */
  ratio: number;
  /** Sortable date; larger is newer. */
  when: number;
  /** Lower-cased text a search query is matched against. */
  search: string;
} & ({ kind: 'project'; project: Project } | { kind: 'piece'; item: GalleryItem });

/** Project covers are cropped to one shape; their real dimensions are not recorded. */
const PROJECT_RATIO = 4 / 3;
/** A piece keeps its own shape, within what a column can hold without one card dwarfing the rest. */
const MIN_RATIO = 0.7;
const MAX_RATIO = 1.78;

/** The shape a piece's card reserves: its own, within the column's limits. */
export function cardRatio(width: number, height: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
}

// Lives in offers.ts so a card on the home page does not pull the gallery data in with it.
export { firstOfferLabel };

/**
 * `YYYY`, `YYYY-MM` or `YYYY-MM-DD` as months since year 0, with the day as
 * a fraction. A bare year counts as its December. Anything else ("Present",
 * "current", null: the data spells "ongoing" several ways) is not a date.
 */
function whenOf(date: string | null | undefined): number | null {
  const match = date?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2] ?? 12) + Number(match[3] ?? 0) / 32;
}

const offerText = (offers: OfferSlug[]) => offers.map(offerLabel).join(' ');

function fromProject(project: Project): WorkEntry {
  return {
    kind: 'project',
    project,
    id: project.slug,
    title: project.title,
    offers: project.offers ?? [],
    cover: project.coverImage,
    ratio: PROJECT_RATIO,
    // A work still in progress has no end date; it sits at its start date so
    // it interleaves with finished work instead of sinking to the bottom.
    when: whenOf(project.endDate) ?? whenOf(project.startDate) ?? Number.NEGATIVE_INFINITY,
    search: [project.title, project.tagline, ...project.keywords, ...project.stack, offerText(project.offers ?? [])]
      .join(' ')
      .toLowerCase(),
  };
}

function fromPiece(item: GalleryItem): WorkEntry {
  return {
    kind: 'piece',
    item,
    id: item.id,
    title: item.title,
    offers: item.offers ?? [],
    cover: item.kind === 'video' ? (item.poster ?? item.src) : item.src,
    ratio: cardRatio(item.width, item.height),
    when: whenOf(item.date) ?? Number.NEGATIVE_INFINITY,
    search: [item.title, item.series ?? '', offerText(item.offers ?? [])].join(' ').toLowerCase(),
  };
}

/**
 * Everything the works index lists, newest first: every listed project, and
 * every gallery piece that is not already shown on a project's own page
 * (`workSlug`).
 */
export const workEntries: WorkEntry[] = [
  ...projects.map(fromProject),
  ...galleryItems.filter((item) => !item.workSlug).map(fromPiece),
].sort((a, b) => b.when - a.when || a.title.localeCompare(b.title));

/** The `?offer=` value, if it names a real offer. */
export function parseOffer(value: string | null): OfferSlug | null {
  return OFFERS.find((offer) => offer.slug === value)?.slug ?? null;
}

/** Entries tagged with `offer` (all of them when it is null) whose text contains `query`. */
export function filterEntries(entries: WorkEntry[], offer: OfferSlug | null, query: string): WorkEntry[] {
  const text = query.trim().toLowerCase();
  return entries.filter(
    (entry) => (offer === null || entry.offers.includes(offer)) && (text === '' || entry.search.includes(text)),
  );
}

/**
 * Deal cards into columns, each one into whichever column is shortest so far
 * (leftmost on a tie).
 *
 * A card's place depends only on the cards before it, so adding more to the
 * end never moves one that is already on screen.
 */
export function distribute<T extends { ratio: number }>(entries: T[], columns: number): T[][] {
  const out: T[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  const heights = out.map(() => 0);
  for (const entry of entries) {
    const shortest = heights.indexOf(Math.min(...heights));
    out[shortest].push(entry);
    heights[shortest] += 1 / entry.ratio;
  }
  return out;
}
