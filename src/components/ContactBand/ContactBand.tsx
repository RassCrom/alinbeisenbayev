import Button from '../Button/Button';
import { CTA } from '../Nav/Nav';

/** Pages where the band would only repeat what the page already is, or that fill the screen. */
const WITHOUT_BAND = ['/contact', '/connect', '/journal/map-awards', '/blog/map-awards'];

export function showContactBand(pathname: string): boolean {
  return !WITHOUT_BAND.includes(pathname);
}

/** The call to action, once more, where every page ends. */
export default function ContactBand() {
  return (
    <section className="contact-band wrap">
      <div className="contact-band__inner">
        <div className="contact-band__copy">
          <h2 className="t-h2">Start a project</h2>
          <p className="t-meta">Tell me what you need and I will reply by email.</p>
        </div>
        <Button to={CTA.to}>{CTA.label}</Button>
      </div>
    </section>
  );
}
