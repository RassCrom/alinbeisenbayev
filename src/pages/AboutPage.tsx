import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import Frame from '../components/Frame/Frame';
import Skeleton from '../components/Skeleton/Skeleton';
import aboutData from '../data/about-story.json';
import { audience, audienceDate, awards } from '../data/proof';
import { socials } from '../data/socials';
import { usePageMeta } from '../hooks/usePageMeta';
import { useScrollStory } from '../hooks/useScrollStory';
import type { AboutStoryData } from '../types';

// The canvas globe and its coastline data are needed only here, and only
// once the reader reaches the route.
const GlobeStory = lazy(() => import('../components/GlobeStory/GlobeStory'));

const { profile, story } = aboutData as unknown as AboutStoryData;
const cv = socials.find((social) => social.platform === 'CV');
const profiles = socials.filter((social) => social.platform !== 'CV');

/**
 * Who he is, what backs that up, where else to find him, and the route that
 * got him here, told stop by stop on a globe.
 */
export default function AboutPage() {
  usePageMeta('About', 'Alikhan Beisenbayev, cartographer and data storyteller: recognition, audience, and the route from Astana to Vienna.');
  const { activeIndex, visible, setPanelRef, scrollToPanel } = useScrollStory(story.length);

  return (
    <div className="about">
      <header className="about__head wrap">
        <div className="about__photo">
          <Frame src={profile.photo} alt={profile.name} width={800} height={800} ratio="1 / 1" priority />
        </div>
        <div className="about__intro">
          <h1 className="t-display">{profile.name}</h1>
          <p className="work-page__lede">{profile.title}</p>
          {profile.bio.split('\n').filter(Boolean).map((paragraph) => (
            <p key={paragraph} className="about__bio">
              {paragraph}
            </p>
          ))}
          {cv && (
            <div>
              <a href={cv.url} download className="button button--quiet button--md focus-ring">
                Download CV
              </a>
            </div>
          )}
        </div>
      </header>

      {awards.length > 0 && (
        <section className="home-section wrap">
          <h2 className="t-h2">Recognition</h2>
          <ul className="rows">
            {awards.map((item) => (
              <li key={`${item.slug}-${item.award}`}>
                <span>{item.award}</span>
                <Link to={`/works/${item.slug}`} className="rows__link focus-ring">
                  {item.work}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {audience.length > 0 && (
        <section className="home-section wrap">
          <h2 className="t-h2">Audience</h2>
          <dl className="facts about__audience">
            {audience.map((item) => (
              <div key={item.platform}>
                <dt>{item.platform}</dt>
                <dd>{item.count} followers</dd>
              </div>
            ))}
          </dl>
          {audienceDate && <p className="t-meta about__counted">Counted {audienceDate}.</p>}
        </section>
      )}

      <section className="home-section wrap">
        <h2 className="t-h2">Find me elsewhere</h2>
        <ul className="rows profiles">
          {profiles.map((social) => {
            const outside = social.url.startsWith('http');
            return (
              <li key={social.id}>
                <a
                  href={social.url}
                  target={outside ? '_blank' : undefined}
                  rel={outside ? 'noreferrer' : undefined}
                  className="rows__link focus-ring"
                >
                  {social.platform}
                </a>
                <span>{social.description}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="home-section">
        <div className="wrap">
          <h2 className="t-h2">The route so far</h2>
        </div>
        {/* overflow clip, not hidden: hidden would make a scroll container and break the sticky globe. */}
        <div className="route">
          <div className="route__globe">
            <Suspense fallback={<Skeleton className="route__globe-skeleton" />}>
              <GlobeStory points={story} activeStoryIndex={activeIndex} onPointClick={scrollToPanel} />
            </Suspense>
          </div>
          <div className="route__panels">
            {story.map((point, index) => (
              <section key={point.id} ref={setPanelRef(index)} data-story-index={index} className="route__panel">
                <div className={visible[index] ? 'route__card is-visible' : 'route__card'}>
                  <p className="t-meta">
                    {point.date}, {point.location.name}
                  </p>
                  <h3 className="t-h3">{point.title}</h3>
                  <p className="route__text">{point.description}</p>
                  {point.images.map((image) => (
                    <Frame key={image} src={image} alt="" width={1200} height={675} ratio="16 / 9" small />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
