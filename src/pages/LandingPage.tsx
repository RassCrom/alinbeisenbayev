import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import WorkCard from '../components/WorkCard/WorkCard';
import projectsData from '../data/projects.json';
import aboutData from '../data/about-story.json';
import socialsData from '../data/socials.json';
import type { ProjectsData, AboutStoryData, SocialsData } from '../types';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = '/map-styles/portfolio-dark.json';

const fmtCoord = (lat: number, lng: number): string =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`;

const { projects } = projectsData as ProjectsData;
const { profile, story, endCta } = aboutData as unknown as AboutStoryData;
const { socials } = socialsData as SocialsData;

function HeroMapBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [71.43, 51.17],
        zoom: 3,
        interactive: false,
        attributionControl: false,
      });
      map.on('load', () => {
        if (!map || cancelled) return;
        const drift = () => {
          if (!map) return;
          const center = map.getCenter();
          map.easeTo({ center: [center.lng + 10, center.lat], duration: 24000, easing: (t) => t });
        };
        map.on('moveend', drift);
        drift();
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
    };
  }, []);

  return <div ref={containerRef} aria-hidden="true" className="absolute inset-0 opacity-30" />;
}

export default function LandingPage() {
  const featured = projects.filter((p) => p.featured).slice(0, 6);
  const heroSocials = socials.filter((s) => s.featured && s.platform !== 'CV');
  const worksSectionRef = useRef<HTMLElement>(null);
  const originCoord = story[6]?.location;

  return (
    <>
      {/* Hero */}
      <section
        className="relative flex h-[calc(100vh-4rem)] items-center justify-center overflow-hidden"
        style={{ background: 'var(--gradient-hero)' }}
      >
        <HeroMapBackground />
        <div className="relative z-[var(--z-raised)] flex flex-col items-center gap-[var(--space-4)] px-[var(--space-6)] text-center">
          <img
            src={profile.photo}
            alt={profile.name}
            width={180}
            height={180}
            className="h-[180px] w-[180px] rounded-[var(--radius-full)] border-2 border-[var(--color-accent)] object-cover shadow-[var(--shadow-glow)]"
          />
          <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-4xl)] font-extrabold sm:text-[length:var(--text-5xl)]">
            {profile.name}
          </h1>
          <p className="font-[family-name:var(--font-mono)] text-[length:var(--text-base)] tracking-[0.1em] text-[var(--color-accent-light)] sm:text-[length:var(--text-lg)]">
            {profile.title}
          </p>
          <p className="max-w-md font-[family-name:var(--font-body)] italic text-[var(--color-text-secondary)]">
            {profile.tagline}
          </p>
          {originCoord && (
            <p className="coord-label">
              {fmtCoord(originCoord.lat, originCoord.lng)}
            </p>
          )}
          {profile.languages.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-[var(--space-2)]">
              {profile.languages.map((language) => (
                <span key={language} className="pill">
                  {language}
                </span>
              ))}
            </div>
          )}
          <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-4)]">
            {heroSocials.map((social) => (
              <a
                key={social.id}
                href={social.url}
                target={social.url.startsWith('mailto:') ? undefined : '_blank'}
                rel="noreferrer"
                title={social.platform}
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                <img src={social.iconUrl} alt={social.platform} width={24} height={24} />
              </a>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label="Scroll to selected works"
          onClick={() => worksSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-[var(--space-6)] left-1/2 flex h-11 w-11 -translate-x-1/2 animate-[bounce-soft_2s_ease-in-out_infinite] items-center justify-center text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </section>

      {/* Featured works */}
      <section
        ref={worksSectionRef}
        className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-24)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-4)]">
          <h2 className="heading-section">Selected Works</h2>
          <Link
            to="/works"
            className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {endCta.worksLabel} →
          </Link>
        </div>
        <div className="mt-[var(--space-8)] grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2 lg:grid-cols-2">
          {featured.map((project, index) => (
            <div key={project.id} className={index === 0 || index === featured.length - 1 ? 'md:col-span-2' : ''}>
              <WorkCard
                id={project.id}
                slug={project.slug}
                title={project.title}
                year={project.endDate ? Number(project.endDate.slice(0, 4)) || null : null}
                category={project.category}
                tagline={project.tagline}
                coverImage={project.coverImage}
                award={project.awards[0]}
                featured={project.featured}
                status={project.status}
                type={project.type}
                index={index}
                large={index === 0}
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
