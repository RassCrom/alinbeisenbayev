import Button from '../Button/Button';
import { CTA } from '../Nav/Nav';
import type { OfferSlug } from '../../data/offers';

/** Pages where the band would only repeat what the page already is, or that fill the screen. */
const WITHOUT_BAND = ['/contact', '/connect', '/journal/map-awards'];

/** Whether the page shell should end a page with the standard band. */
export function showContactBand(pathname: string): boolean {
  // A work page places its own band, worded for that work.
  if (pathname.startsWith('/works/')) return false;
  return !WITHOUT_BAND.includes(pathname);
}

export interface ContactBandProps {
  heading?: string;
  line?: string;
  /** Carried to the form, so it opens with this offer already chosen. */
  offer?: OfferSlug;
}

/** The call to action, once more, where every page ends. */
export default function ContactBand({
  heading = 'Start a project',
  line = 'Tell me what you need and I will reply by email.',
  offer,
}: ContactBandProps) {
  return (
    <section className="contact-band wrap">
      <div className="contact-band__inner">
        <div className="contact-band__copy">
          <h2 className="t-h2">{heading}</h2>
          <p className="t-meta">{line}</p>
        </div>
        <Button to={offer ? `${CTA.to}?offer=${offer}` : CTA.to}>{CTA.label}</Button>
      </div>
    </section>
  );
}
