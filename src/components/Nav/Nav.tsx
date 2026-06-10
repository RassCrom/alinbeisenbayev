import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import socialsData from '../../data/socials.json';
import type { SocialsData } from '../../types';

const { socials } = socialsData as SocialsData;
const DRAWER_SOCIALS = socials.filter((s) => s.featured && s.platform !== 'CV');

const NAV_LINKS = [
  { to: '/works', label: 'Works' },
  { to: '/about', label: 'About' },
  { to: '/skills', label: 'Skills' },
  { to: '/blog', label: 'Blog' },
  { to: '/connect', label: 'Connect' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `mono-label transition-colors hover:text-[var(--color-text-primary)] ${
      isActive ? 'text-[var(--color-accent-light)]' : ''
    }`;

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-[var(--z-overlay)] border-b border-[var(--color-border-subtle)] bg-[rgba(13,19,32,0.85)] backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-[var(--space-6)]">
        <Link
          to="/"
          className="font-[family-name:var(--font-heading)] text-[length:var(--text-lg)] font-extrabold tracking-tight"
        >
          alin<span className="text-[var(--color-accent-light)]">beisenbayev</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-[var(--space-8)] md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
        >
          <span
            className={`h-0.5 w-6 bg-[var(--color-text-primary)] transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`}
          />
          <span
            className={`h-0.5 w-6 bg-[var(--color-text-primary)] transition-opacity ${open ? 'opacity-0' : ''}`}
          />
          <span
            className={`h-0.5 w-6 bg-[var(--color-text-primary)] transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`}
          />
        </button>
      </nav>
    </header>

      {/* Mobile slide-in drawer (sibling of header: backdrop-filter on the
          header would otherwise become the containing block for fixed children) */}
      <div
        className={`fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-64 transform flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-elevated)] transition-transform duration-300 md:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="absolute right-[var(--space-4)] top-[var(--space-4)] flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] text-[length:var(--text-2xl)] leading-none text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
        >
          ×
        </button>
        <div className="flex flex-col gap-[var(--space-6)] p-[var(--space-8)] pt-[var(--space-24)]">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </div>
        {/* Social links pinned to the drawer bottom */}
        <div className="mt-auto border-t border-[var(--color-border-subtle)] px-[var(--space-6)] py-[var(--space-6)]">
          <div className="flex items-center justify-between gap-[var(--space-2)]">
            {DRAWER_SOCIALS.map((social) => (
              <a
                key={social.id}
                href={social.url}
                target={social.url.startsWith('mailto:') ? undefined : '_blank'}
                rel="noreferrer"
                aria-label={social.platform}
                title={social.platform}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] opacity-80 transition-all hover:border-[var(--color-accent)] hover:opacity-100 active:scale-95"
              >
                <img src={social.iconUrl} alt="" width={20} height={20} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      </div>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[var(--z-overlay)] cursor-default bg-black/40 md:hidden"
        />
      )}
    </>
  );
}
