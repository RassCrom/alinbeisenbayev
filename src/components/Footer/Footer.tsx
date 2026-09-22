import { Link } from 'react-router-dom';
import socialsData from '../../data/socials.json';
import { NAV_LINKS } from '../Nav/Nav';
import aboutData from '../../data/about-story.json';
import type { SocialsData, AboutStoryData } from '../../types';

const { socials } = socialsData as SocialsData;
const { profile } = aboutData as AboutStoryData;

/**
 * Laid out like the margin of a printed map: a legend (site links), sources
 * (socials) and a colophon.
 */
export default function Footer() {
  const featured = socials.filter((s) => s.featured && s.platform !== 'CV');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <div className="mx-auto grid max-w-6xl gap-[var(--space-8)] px-[var(--space-6)] pb-[var(--space-10)] pt-[var(--space-10)] sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-[family-name:var(--font-heading)] text-[length:var(--text-lg)] font-semibold text-[var(--color-text-primary)]">
            {profile.name}
          </p>
          <p className="mt-[var(--space-2)] max-w-xs text-[length:var(--text-sm)] italic text-[var(--color-text-secondary)]">
            {profile.tagline}
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="mono-label mb-[var(--space-3)] text-[var(--color-text-primary)]">Legend</p>
          <ul className="grid grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="group inline-flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  <span
                    aria-hidden="true"
                    className="h-[7px] w-[7px] rotate-45 border border-[var(--color-accent-gold)] transition-colors group-hover:bg-[var(--color-accent-gold)]"
                  />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mono-label mb-[var(--space-3)] text-[var(--color-text-primary)]">Sources</p>
          <ul className="grid gap-[var(--space-2)]">
            {featured.map((social) => (
              <li key={social.id}>
                <a
                  href={social.url}
                  target={social.url.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noreferrer"
                  className="inline-flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  <img src={social.iconUrl} alt="" width={16} height={16} loading="lazy" className="opacity-70" />
                  {social.platform}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid content-start gap-[var(--space-3)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          <div>
            <dt className="mono-label">Cartographer</dt>
            <dd className="mt-[2px] text-[var(--color-text-secondary)]">{profile.name}</dd>
          </div>
          <div>
            <dt className="mono-label">Role</dt>
            <dd className="mt-[2px] text-[var(--color-text-secondary)]">{profile.title}</dd>
          </div>
          <div>
            <dt className="mono-label">Edition</dt>
            <dd className="mt-[2px] text-[var(--color-text-secondary)]">© {year}</dd>
          </div>
        </dl>
      </div>
    </footer>
  );
}
