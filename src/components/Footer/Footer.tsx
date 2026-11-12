import { Link } from 'react-router-dom';
import { NAV_LINKS } from '../Nav/Nav';
import { featuredSocials } from '../../data/socials';

// INTERIM: remove in plans 2 and 3, when the gallery joins the works index
// and the blog joins the journal. Until then these pages have no other door.
const INTERIM_LINKS = [
  { to: '/gallery', label: 'Gallery' },
  { to: '/blog', label: 'Blog' },
] as const;

/**
 * The footer shell. The field-cartographer illustration sits above this in
 * plan 5; the top margin leaves it room.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner wrap">
        <p className="footer__name">Alikhan Beisenbayev</p>

        <nav aria-label="Footer" className="footer__links">
          {[...NAV_LINKS, ...INTERIM_LINKS].map((link) => (
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
