import type { GalleryItem } from '../types';
import collaborationData from './collaborations.json';
import galleryData from './gallery.json';
import { projects } from './projects';
import { socials } from './socials';

export interface Collaboration {
  id: string;
  name: string;
  detail: string;
  /** Logo under /clients/, drawn as a one-colour mask so it follows the theme. */
  logo?: string;
  /** Words set beside a logo that is only a mark (Lichess's knight). */
  logoText?: string;
  /** A gallery piece made for this client, shown in the showcase. */
  galleryId?: string;
  /** A piece that is not in the gallery: its own image under /clients/. */
  showcase?: { title: string; image: string; width: number; height: number };
}

/** Pages and partners the maps were made for or with, and how many client projects are done. */
export const collaborations: Collaboration[] = collaborationData.collaborations;
export const completedProjects: string = collaborationData.completedProjects;

/** Clients with a logo, in the order the data lists them: the "Trusted by" strip. */
export const clientLogos = collaborations.filter((item) => item.logo);

/** Clients with a piece to show, paired with that piece (hidden pieces included: the client chose them, not the gallery). */
export const clientShowcase = collaborations.flatMap((client) => {
  if (client.showcase) {
    const { title, image, width, height } = client.showcase;
    return [{ client, piece: { title, image, width, height, workSlug: undefined as string | undefined } }];
  }
  const item = (galleryData.items as unknown as GalleryItem[]).find((entry) => entry.id === client.galleryId);
  if (!item) return [];
  const image = item.kind === 'video' ? (item.poster ?? item.src) : item.src;
  return [{ client, piece: { title: item.title, image, width: item.width, height: item.height, workSlug: item.workSlug } }];
});

/*
 * What backs the About page's claims, read from the data and nothing else:
 * the awards recorded on listed works and the follower counts recorded on
 * profiles. A number that is not in a data file does not appear on the site.
 */

/** One recognition, with the work that earned it. */
export const awards: { award: string; work: string; slug: string }[] = projects.flatMap((project) =>
  project.awards.map((award) => ({ award, work: project.title, slug: project.slug })),
);

/** Profiles that carry a follower count. */
export const audience: { platform: string; count: string }[] = socials
  .filter((social) => social.followers)
  .map((social) => ({ platform: social.platform, count: social.followers! }));

/** "(09.19.26)", month.day.year as the data writes it, to "19 September 2026". */
export function parseCountDate(raw: string | undefined): string | null {
  const match = raw?.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, month, day, year] = match;
  const date = new Date(Date.UTC(2000 + Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * When the counts were taken, if every counted profile agrees. Counts taken
 * on different days get no single date rather than a wrong one.
 */
export const audienceDate: string | null = (() => {
  const dates = new Set(socials.filter((social) => social.followers).map((social) => social.follower_date));
  return dates.size === 1 ? parseCountDate([...dates][0]) : null;
})();
