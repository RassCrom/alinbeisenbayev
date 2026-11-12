import { Link } from 'react-router-dom';
import FieldCartographer from '../FieldCartographer/FieldCartographer';
import { NAV_LINKS } from '../Nav/Nav';
import { featuredSocials } from '../../data/socials';

/** How every page ends: the field cartographer, then the name, the ways around and the ways out. */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <FieldCartographer />
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
