import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';

export const NAV_LINKS = [
  { to: '/works', label: 'Work' },
  { to: '/journal', label: 'Journal' },
  { to: '/about', label: 'About' },
] as const;

/** The site's one call to action. It sits in the nav on every page. */
export const CTA = { to: '/contact', label: 'Work with me' } as const;

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // A link in the sheet navigates; the sheet should not outlive that.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Open: focus moves into the sheet and Escape closes it. Close: focus goes
  // back to the menu button, unless a route change already moved it.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const active = document.activeElement;
      if (active === document.body || active === closeRef.current) toggleRef.current?.focus();
    };
  }, [open]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav__link nav__link--active focus-ring' : 'nav__link focus-ring';

  return (
    <>
      <header className="nav">
        <nav className="nav__bar wrap" aria-label="Main">
          <Link to="/" className="nav__name focus-ring">
            Alikhan<span className="nav__surname"> Beisenbayev</span>
          </Link>

          <div className="nav__links">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="nav__end">
            <Button to={CTA.to} size="sm">
              {CTA.label}
            </Button>
            <button
              ref={toggleRef}
              type="button"
              className="nav__toggle focus-ring"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </nav>
      </header>

      {/* A sibling of the header, not a child: the header's backdrop blur
          would make it the containing block for a fixed descendant. */}
      {open && (
        <div className="nav__sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="nav__sheet-top wrap">
            <button
              ref={closeRef}
              type="button"
              className="nav__toggle nav__toggle--close focus-ring"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="nav__sheet-links wrap">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
