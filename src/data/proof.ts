import { projects } from './projects';
import { socials } from './socials';

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
