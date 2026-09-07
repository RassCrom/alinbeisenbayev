import { Link } from 'react-router-dom';
import socialsData from '../../data/socials.json';
import { NAV_LINKS } from '../Nav/Nav';
import aboutData from '../../data/about-story.json';
import type { SocialsData, AboutStoryData } from '../../types';

const { socials } = socialsData as SocialsData;
const { profile } = aboutData as AboutStoryData;

export default function Footer() {
  const featured = socials.filter((s) => s.featured && s.platform !== 'CV');

  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <nav
        aria-label="Footer"
        className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-[var(--space-6)] gap-y-[var(--space-2)] px-[var(--space-6)] pt-[var(--space-8)] sm:justify-start"
      >
        {NAV_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="mono-label transition-colors hover:text-[var(--color-text-primary)]">
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-[var(--space-4)] px-[var(--space-6)] pb-[var(--space-10)] pt-[var(--space-6)] sm:flex-row sm:justify-between">
        <p className="font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
          © {new Date().getFullYear()} {profile.name}
        </p>
        <div className="flex items-center gap-[var(--space-4)]">
          {featured.map((social) => (
            <a
              key={social.id}
              href={social.url}
              target={social.url.startsWith('mailto:') ? undefined : '_blank'}
              rel="noreferrer"
              title={social.platform}
              className="opacity-70 transition-opacity hover:opacity-100"
            >
              <img src={social.iconUrl} alt={social.platform} width={22} height={22} loading="lazy" />
            </a>
          ))}
        </div>
        <p className="mono-label">{profile.title}</p>
      </div>
    </footer>
  );
}
