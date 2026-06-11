import { Link, useParams } from 'react-router-dom';
import ProcessStep from '../components/ProcessStep/ProcessStep';
import ImageGallery from '../components/ImageGallery/ImageGallery';
import StackRow from '../components/StackRow/StackRow';
import WorkCard from '../components/WorkCard/WorkCard';
import projectsData from '../data/projects.json';
import type { ProjectsData } from '../types';

const { projects } = projectsData as ProjectsData;

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-[var(--space-16)]">
      <h2 className="heading-section">{heading}</h2>
      <div className="mt-[var(--space-4)]">{children}</div>
    </section>
  );
}

export default function WorkDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center gap-[var(--space-4)] px-[var(--space-6)]">
        <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-2xl)] font-bold">
          Work not found
        </h1>
        <Link to="/works" className="btn btn-secondary">
          ← Back to Works
        </Link>
      </div>
    );
  }

  const year = project.endDate ? Number(project.endDate.slice(0, 4)) || null : null;
  const award = project.awards[0];

  // Two other projects with real images, featured first
  const suggestions = projects
    .filter((p) => p.slug !== project.slug && !p.coverImage.includes('placeholder'))
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    .slice(0, 2);

  return (
    <article>
      {/* Hero */}
      <header className="relative h-[45vh] overflow-hidden md:h-[60vh]">
        <img
          src={project.coverImage}
          alt={project.title}
          width={1200}
          height={630}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'var(--gradient-overlay)' }} />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-[var(--space-6)] pb-[var(--space-8)]">
          {award && (
            <span className="mb-[var(--space-3)] inline-block rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.8)] px-[var(--space-3)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-gold)]">
            ★ {award}
            </span>
          )}
          <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold md:text-[length:var(--text-4xl)]">
            {project.title}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-[var(--space-6)] pb-[var(--space-24)]">
        {/* Meta row */}
        <div className="mt-[var(--space-8)] flex flex-wrap items-center gap-[var(--space-4)]">
          <span className="mono-label">{year}</span>
          <span className="mono-label">·</span>
          <span className="mono-label">{project.category}</span>
          <span className="mono-label">·</span>
          <span className="mono-label">{project.role}</span>
        </div>
        <div className="mt-[var(--space-4)]">
          <StackRow stack={project.stack} />
        </div>
        <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-3)]">
          {project.liveUrl && project.type === 'website' && (
            <a href={project.liveUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              View Live ↗
            </a>
          )}
          {project.codeUrl && (
            <a href={project.codeUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
              View Code ↗
            </a>
          )}
        </div>

        {project.context && (
          <Section heading="Context">
            <p className="text-[var(--color-text-secondary)]">{project.context}</p>
          </Section>
        )}

        {project.idea && (
          <Section heading="Idea">
            <p className="text-[var(--color-text-secondary)]">{project.idea}</p>
          </Section>
        )}

        {project.design && (
          <Section heading="Design">
            <p className="text-[var(--color-text-secondary)]">{project.design}</p>
          </Section>
        )}

        {project.inspiration && (
          <Section heading="Inspiration">
            <p className="text-[var(--color-text-secondary)]">{project.inspiration}</p>
          </Section>
        )}

        {project.process?.length > 0 && (
          <Section heading="Process">
            <div className="flex flex-col gap-[var(--space-6)]">
              {project.process.map((step) => (
                <ProcessStep
                  key={step.step}
                  step={step.step}
                  title={step.title}
                  description={step.description}
                  image={step.image}
                />
              ))}
            </div>
          </Section>
        )}

        {project.outcome && (
          <Section heading="Outcome">
            <p className="text-[var(--color-text-secondary)]">{project.outcome}</p>
          </Section>
        )}

        {project.gallery?.length > 0 && (
          <Section heading="Gallery">
            <ImageGallery images={project.gallery} zoomable={project.type === 'static-map'} />
          </Section>
        )}

        {project.stack?.length > 0 && (
          <Section heading="Stack">
            <StackRow stack={project.stack} />
          </Section>
        )}
      </div>

      {/* More Works */}
      {suggestions.length > 0 && (
        <section className="mt-[var(--space-16)] border-t border-[var(--color-border-subtle)]">
          <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-16)]">
            <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-4)]">
              <h2 className="heading-section">More Works</h2>
              <Link
                to="/works"
                className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                All works →
              </Link>
            </div>
            <div className="mt-[var(--space-8)] grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2">
              {suggestions.map((p) => (
                <WorkCard
                  key={p.id}
                  id={p.id}
                  slug={p.slug}
                  title={p.title}
                  year={p.endDate ? Number(p.endDate.slice(0, 4)) || null : null}
                  category={p.category}
                  tagline={p.tagline}
                  coverImage={p.coverImage}
                  award={p.awards[0]}
                  featured={p.featured}
                  status={p.status}
                  type={p.type}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
