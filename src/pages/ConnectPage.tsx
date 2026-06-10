import socialsData from '../data/socials.json';
import type { SocialsData, Social } from '../types';

const { socials } = socialsData as SocialsData;

function actionLabel(social: Social): string {
  if (social.platform === 'CV') return 'Download ↓';
  if (social.url.startsWith('mailto:')) return 'Write Email →';
  return 'Open Profile ↗';
}

export default function ConnectPage() {
  return (
    <div className="mx-auto max-w-4xl px-[var(--space-6)] py-[var(--space-12)]">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
        Connect
      </h1>

      <div className="mt-[var(--space-8)] grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2">
        {socials.map((social) => {
          const isExternal = !social.url.startsWith('mailto:') && social.platform !== 'CV';
          return (
            <div
              key={social.id}
              className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[image:var(--gradient-card)] p-[var(--space-6)] shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-[var(--space-3)]">
                <img src={social.iconUrl} alt="" width={28} height={28} loading="lazy" />
                <div className="min-w-0">
                  <p className="mono-label">{social.platform}</p>
                  <p className="truncate font-[family-name:var(--font-heading)] font-bold">
                    {social.label}
                  </p>
                </div>
              </div>
              <p className="flex-1 font-[family-name:var(--font-body)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
                {social.description}
              </p>
              <a
                href={social.url}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer' : undefined}
                download={social.platform === 'CV' ? true : undefined}
                className={`btn self-start ${social.platform === 'CV' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {actionLabel(social)}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
