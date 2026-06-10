import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useScrollStory } from '../hooks/useScrollStory';
import aboutData from '../data/about-story.json';
import type { AboutStoryData } from '../types';

// react-globe.gl + three are heavy — load only on this page
const GlobeStory = lazy(() => import('../components/GlobeStory/GlobeStory'));

const { profile, story, endCta } = aboutData as unknown as AboutStoryData;

const INTRO_MS = 2600;

export default function AboutPage() {
  const { activeIndex, visible, setPanelRef } = useScrollStory(story.length);
  // Entrance: the globe opens centered and slowly spinning, then settles into
  // its column while the story panels fade in.
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIntro(false);
      return;
    }
    const timer = setTimeout(() => setIntro(false), INTRO_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    // overflow-x-clip (not hidden) kills any transient canvas overflow during
    // resize without creating a scroll container, which would break sticky
    <div className="relative overflow-x-clip lg:grid lg:grid-cols-[35%_65%]">
      {/* Globe: full-width sticky background on mobile, right column on desktop */}
      <div
        className={`sticky top-16 z-[var(--z-base)] h-[55vh] w-full overflow-hidden transition-transform duration-1000 ease-out lg:order-2 lg:top-16 lg:h-[calc(100vh-4rem)] ${
          intro ? 'scale-110 lg:-translate-x-[28%] lg:scale-105' : ''
        }`}
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <span className="mono-label">Loading globe…</span>
            </div>
          }
        >
          <GlobeStory points={story} activeStoryIndex={activeIndex} autoRotate={intro} />
        </Suspense>
      </div>

      {/* Story panels: held back until the globe settles */}
      <div
        className={`relative z-[var(--z-raised)] transition-opacity duration-700 lg:order-1 ${
          intro ? 'pointer-events-none opacity-0' : 'opacity-100 delay-300'
        }`}>
        {story.map((point, index) => (
          <section
            key={point.id}
            ref={setPanelRef(index)}
            data-story-index={index}
            className="flex min-h-[80vh] items-center px-[var(--space-6)] py-[var(--space-12)] lg:min-h-[calc(100vh-4rem)] lg:px-[var(--space-12)]"
          >
            <div
              className={`story-reveal ${visible[index] ? 'is-visible' : ''} w-full rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[rgba(18,26,45,0.92)] p-[var(--space-8)] shadow-[var(--shadow-card)] backdrop-blur-sm`}
            >
              <p className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] tracking-[0.1em] text-[var(--color-accent-light)]">
                {point.date} — {point.location.name}
              </p>
              <h2 className="mt-[var(--space-3)] font-[family-name:var(--font-heading)] text-[length:var(--text-2xl)] font-bold">
                {point.title}
              </h2>
              <p className="mt-[var(--space-4)] font-[family-name:var(--font-body)] text-[var(--color-text-secondary)]">
                {point.description}
              </p>
              {point.images.length > 0 && (
                <div className="mt-[var(--space-6)] grid gap-[var(--space-4)]">
                  {point.images.map((image, imageIndex) => (
                    <img
                      key={imageIndex}
                      src={image}
                      alt={point.title}
                      width={1200}
                      height={630}
                      loading="lazy"
                      className="aspect-video w-full rounded-[var(--radius-md)] object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}

        {/* End of story: bio + CTA */}
        <section className="flex min-h-[80vh] items-center px-[var(--space-6)] py-[var(--space-12)] lg:min-h-[calc(100vh-4rem)] lg:px-[var(--space-12)]">
          <div className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[rgba(18,26,45,0.92)] p-[var(--space-8)] shadow-[var(--shadow-card)] backdrop-blur-sm">
            <img
              src={profile.photo}
              alt={profile.name}
              width={96}
              height={96}
              loading="lazy"
              className="h-24 w-24 rounded-[var(--radius-full)] border-2 border-[var(--color-accent)] object-cover"
            />
            <h2 className="mt-[var(--space-6)] font-[family-name:var(--font-heading)] text-[length:var(--text-2xl)] font-bold">
              {endCta.heading}
            </h2>
            <p className="mt-[var(--space-4)] font-[family-name:var(--font-body)] text-[var(--color-text-secondary)]">
              {profile.bio}
            </p>
            <div className="mt-[var(--space-8)] flex flex-wrap gap-[var(--space-4)]">
              <Link to="/works" className="btn btn-primary">
                {endCta.worksLabel}
              </Link>
              <Link to="/connect" className="btn btn-secondary">
                {endCta.contactLabel}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
