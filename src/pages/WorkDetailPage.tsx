import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../components/Button/Button';
import ContactBand from '../components/ContactBand/ContactBand';
import Frame from '../components/Frame/Frame';
import ImageGallery from '../components/ImageGallery/ImageGallery';
import SourceNote from '../components/SourceNote/SourceNote';
import StoryCallout from '../components/StoryCallout/StoryCallout';
import VideoGallery from '../components/VideoGallery/VideoGallery';
import WorkCard from '../components/WorkCard/WorkCard';
import { articles } from '../content/blog';
import { allProjects, projects } from '../data/projects';
import { storyForWork } from '../data/stories';
import { usePageMeta } from '../hooks/usePageMeta';
import { projectYear } from '../utils/date';
import { COVER_SIZES } from '../utils/images';
import type { ProcessStepData, Project } from '../types';
import NotFoundPage from './NotFoundPage';

/** Steps with something written in them. The data has carried empty placeholders. */
function writtenSteps(project: Project): ProcessStepData[] {
  return project.process.filter((step) => step.title?.trim() || step.description?.trim());
}

/**
 * Two shapes of work page.
 *
 * `full` is a case study told in sections, and a work earns it only with a
 * beginning, a middle and an end: context, at least one process step, and an
 * outcome. Anything less gets `short`, which leads with the work itself and
 * says what there is to say in a few paragraphs. A thin entry laid out as a
 * case study reads as an abandoned one.
 */
export function layoutFor(project: Project): 'full' | 'short' {
  return project.context && project.outcome && writtenSteps(project).length > 0 ? 'full' : 'short';
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="work-section">
      <h2 className="t-h2">{heading}</h2>
      {children}
    </section>
  );
}

export default function WorkDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const project = allProjects.find((p) => p.slug === slug);

  // Before the not-found branch: hooks can't sit behind a conditional return.
  // NotFoundPage sets its own title and robots tag, so skip ours then.
  usePageMeta(project?.title, project?.tagline, { enabled: Boolean(project) });

  // A hash link lands on its section once the lazy page has mounted; the
  // router does not do this itself.
  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  }, [project]);

  if (!project) return <NotFoundPage />;

  const full = layoutFor(project) === 'full';
  const steps = writtenSteps(project);
  const hasGallery = (project.gallery?.length ?? 0) > 0;
  const hasVideos = (project.videos?.length ?? 0) > 0;
  const hasMedia = hasGallery || hasVideos;

  // The published piece this work is about, if there is one. It stands in for
  // "View live": for every work with a story, both went to the same address.
  const story = storyForWork(project.slug);
  const methodNotes = articles.filter((article) => article.frontmatter.workSlug === project.slug);
  const year = projectYear(project.endDate);

  const facts: [string, string][] = [];
  if (project.role) facts.push(['Role', project.role]);
  if (year) facts.push(['Year', String(year)]);
  if (project.stack?.length) facts.push(['Tools', project.stack.join(', ')]);
  if (project.awards?.length) facts.push(['Award', project.awards.join('; ')]);

  // Everything written about a short work, in the order it was asked for.
  const shortText = [
    project.context,
    project.idea,
    project.design,
    project.inspiration,
    ...steps.map((step) => [step.title, step.description].filter(Boolean).join('. ')),
    project.outcome,
  ].filter((text): text is string => Boolean(text?.trim()));

  // Two other works with real covers, featured first.
  const suggestions = projects
    .filter((p) => p.slug !== project.slug && !p.coverImage.includes('placeholder'))
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    .slice(0, 2);

  const cover = (
    <div className="work-page__cover wrap">
      <Frame
        src={project.coverImage}
        // The title is the page's heading.
        alt=""
        width={1600}
        height={900}
        ratio="16 / 9"
        sizes={COVER_SIZES.hero}
        priority
        // Pairs with the same name on the card, so arriving from a grid
        // grows the card's cover into this one.
        viewTransitionName={`cover-${project.slug}`}
      />
    </div>
  );

  return (
    <article className="work-page">
      {/* A full work opens on its cover. A short one opens on its title and
          goes straight to the media, where the cover usually is already. */}
      {full && cover}

      <header className="work-page__head wrap">
        <h1 className="t-display">{project.title}</h1>
        {project.tagline && <p className="work-page__lede">{project.tagline}</p>}

        {facts.length > 0 && (
          <dl className="facts">
            {facts.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {((project.liveUrl && project.type === 'website' && !story) || project.codeUrl) && (
          <div className="work-page__links">
            {project.liveUrl && project.type === 'website' && !story && (
              <Button variant="quiet" href={project.liveUrl} external icon="arrow-up-right">
                View live
              </Button>
            )}
            {project.codeUrl && (
              <Button variant="quiet" href={project.codeUrl} external icon="arrow-up-right">
                View code
              </Button>
            )}
          </div>
        )}
      </header>

      {story && (
        <div className="work-page__text wrap">
          <StoryCallout story={story} />
        </div>
      )}

      {full ? (
        <>
          <div className="work-page__text wrap">
            <Section heading="Context">
              <p>{project.context}</p>
            </Section>
            {project.idea && (
              <Section heading="Idea">
                <p>{project.idea}</p>
              </Section>
            )}
            {project.design && (
              <Section heading="Design">
                <p>{project.design}</p>
              </Section>
            )}
            {project.inspiration && (
              <Section heading="Inspiration">
                <p>{project.inspiration}</p>
              </Section>
            )}
            <Section heading="Process">
              <ol className="process">
                {steps.map((step, index) => (
                  <li key={step.step ?? index}>
                    {step.title && <h3 className="t-h3">{step.title}</h3>}
                    {step.description && <p>{step.description}</p>}
                    {step.image && (
                      <Frame src={step.image} alt={step.title ?? ''} width={1200} height={630} small />
                    )}
                  </li>
                ))}
              </ol>
            </Section>
            <Section heading="Outcome">
              <p>{project.outcome}</p>
            </Section>
          </div>

          {hasVideos && (
            <div className="work-page__media wrap">
              <VideoGallery videos={project.videos!} />
            </div>
          )}
          {hasGallery && (
            <div className="work-page__media wrap">
              <ImageGallery images={project.gallery} />
            </div>
          )}
        </>
      ) : (
        <>
          {hasGallery && (
            <div className="work-page__media wrap">
              <ImageGallery images={project.gallery} layout="showcase" />
            </div>
          )}
          {hasVideos && (
            <div className="work-page__media wrap">
              <VideoGallery videos={project.videos!} />
            </div>
          )}
          {!hasMedia && cover}

          {shortText.length > 0 && (
            <div className="work-page__text wrap">
              <Section heading="About this work">
                {shortText.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </Section>
            </div>
          )}
        </>
      )}

      <div className="work-page__text wrap">
        <SourceNote project={project} />
      </div>

      {methodNotes.length > 0 && (
        <div className="work-page__text wrap">
          <Section heading="Method notes">
            <ul className="work-page__notes">
              {methodNotes.map((note) => (
                <li key={note.slug}>
                  <Link to={`/journal/${note.slug}`} className="t-h3 focus-ring">
                    {note.frontmatter.title}
                  </Link>
                  <p className="t-meta">{note.frontmatter.excerpt}</p>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <ContactBand heading="Work with me on something like this" offer={project.offers?.[0]} />

      {suggestions.length > 0 && (
        <section className="home-section wrap">
          <div className="section-head">
            <h2 className="t-h2">More work</h2>
            <Button variant="quiet" to="/works" icon="arrow-right">
              All works
            </Button>
          </div>
          <div className="work-grid work-grid--flush">
            {suggestions.map((p) => (
              <WorkCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
