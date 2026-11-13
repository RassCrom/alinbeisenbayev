import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import Button from '../Button/Button';
import { CTA, NAV_LINKS } from '../Nav/Nav';
import { featuredSocials } from '../../data/socials';

// The drawing is at the bottom of every page and about 10 KB of paths. It
// arrives in its own chunk so it never weighs on a page's first paint.
const FieldCamp = lazy(() => import('../FieldCamp/FieldCamp'));

export interface FooterProps {
  /** Off on the contact page itself and on pages that end with their own call to action. */
  cta?: boolean;
}

/**
 * How every page ends: the offer once more, over the field camp, then the
 * name, the ways around and the ways out.
 */
export default function Footer({ cta = true }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__scene">
        {cta && (
          <div className="footer__cta wrap">
            <div className="footer__cta-copy">
              <h2 className="t-h2">Start a project</h2>
              <p className="t-meta">Tell me what you need and I will reply by email.</p>
            </div>
            <Button to={CTA.to}>{CTA.label}</Button>
          </div>
        )}
        {/* The empty box has the drawing's shape, so nothing moves when it arrives. */}
        <Suspense fallback={<div className="field-camp" aria-hidden="true" />}>
          <FieldCamp />
        </Suspense>
      </div>
      <div className="footer__inner wrap">
        <p className="footer__name">Alikhan Beisenbayev</p>

        <nav aria-label="Footer" className="footer__links">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="footer__link focus-ring">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="footer__links">
          {featuredSocials.map((social) => {
            const outside = social.url.startsWith('http');
            return (
              <a
                key={social.id}
                href={social.url}
                target={outside ? '_blank' : undefined}
                rel={outside ? 'noreferrer' : undefined}
                className="footer__link focus-ring"
              >
                {social.platform}
              </a>
            );
          })}
        </div>

        <p className="footer__year">© {year}</p>
      </div>
    </footer>
  );
}
