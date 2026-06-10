import socialsData from '../../data/socials.json';
import aboutData from '../../data/about-story.json';
import type { SocialsData, AboutStoryData } from '../../types';

const { socials } = socialsData as SocialsData;
const { profile } = aboutData as AboutStoryData;

export default function Footer() {
  const featured = socials.filter((s) => s.featured && s.platform !== 'CV');

  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-10)] sm:flex-row sm:justify-between">
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
