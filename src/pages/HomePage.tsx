import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button/Button';
import HeroStack from '../components/HeroStack/HeroStack';
import Icon from '../components/Icon/Icon';
import JournalCard from '../components/JournalCard/JournalCard';
import { CTA } from '../components/Nav/Nav';
import WorkCard from '../components/WorkCard/WorkCard';
import { featuredWorks } from '../data/featured';
import { OFFERS, offerHref } from '../data/offers';
import { projects } from '../data/projects';
import { stories } from '../data/stories';
import { usePageMeta } from '../hooks/usePageMeta';
import { prefersReducedMotion } from '../utils/motion';

const JOURNAL_ENTRIES = 3;

export default function HomePage() {
  // No arguments: the home page is the site title, and this resets the head
  // after a route that set its own.
  usePageMeta();

  const featured = featuredWorks(projects);
  const [lead, ...others] = featured;
  // Two to a row under the lead; an odd one out would sit alone on its row.
  const rest = others.slice(0, others.length - (others.length % 2));
  // `stories` is already newest first.
  const latest = stories.slice(0, JOURNAL_ENTRIES);

  const worksRef = useRef<HTMLElement>(null);
  const scrollToWorks = () =>
    worksRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

  return (
    <>
      <section className="home-hero">
        <div className="home-hero__inner wrap">
          <div className="home-hero__copy">
            <h1 className="t-display">Maps that show what data alone cannot.</h1>
            <p className="home-hero__lede">
              Custom maps, spatial analysis, data visualization, data journalism and remote sensing. Open for
              commissions and collaboration.
            </p>
            <div className="home-hero__actions">
              <Button to={CTA.to}>{CTA.label}</Button>
              <Button variant="quiet" icon="arrow-down" onClick={scrollToWorks}>
                See the work
              </Button>
            </div>
          </div>
          <HeroStack works={featured} />
        </div>
      </section>

      <section ref={worksRef} className="home-section home-section--first wrap">
        <div className="section-head">
          <h2 className="t-h2">Selected work</h2>
          <Button variant="quiet" to="/works" icon="arrow-right">
            All works
          </Button>
        </div>
        {lead && <WorkCard project={lead} size="lead" />}
        {rest.length > 0 && (
          <div className="work-grid">
            {rest.map((project) => (
              <WorkCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <section className="home-section wrap">
        <h2 className="t-h2">What I can make for you</h2>
        <ul className="offers">
          {OFFERS.map((offer) => (
            <li key={offer.slug}>
              <Link to={offerHref(offer.slug)} className="offers__link focus-ring">
                {offer.label}
                <Icon name="arrow-right" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {latest.length > 0 && (
        <section className="home-section wrap">
          <div className="section-head">
            <h2 className="t-h2">Journal</h2>
            <Button variant="quiet" to="/journal" icon="arrow-right">
              All entries
            </Button>
          </div>
          <div className="journal-grid">
            {latest.map((story) => (
              // Plan 3 moves these to /journal/<slug>.
              <JournalCard
                key={story.id}
                title={story.title}
                href={`/stories/${story.slug}`}
                cover={story.coverImage}
                kind="Story"
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
