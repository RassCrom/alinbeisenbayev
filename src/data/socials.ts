import type { Social, SocialsData } from '../types';
import socialsData from './socials.json';

/** Every social link the Connect page lists: all but the ones marked `"hidden": true`. */
export const socials: Social[] = (socialsData as SocialsData).socials.filter((social) => !social.hidden);

/** The icon row in the nav drawer, footer and landing hero: featured links, minus the CV file. */
export const featuredSocials: Social[] = socials.filter((social) => social.featured && social.platform !== 'CV');

export function isExternalSocial(social: Social): boolean {
  return !social.url.startsWith('mailto:') && social.platform !== 'CV';
}
