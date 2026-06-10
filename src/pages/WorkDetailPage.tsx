import { Link, useParams } from 'react-router-dom';
import ProcessStep from '../components/ProcessStep/ProcessStep';
import ImageGallery from '../components/ImageGallery/ImageGallery';
import StackRow from '../components/StackRow/StackRow';
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

  const year = Number(project.endDate.slice(0, 4));
  const award = project.awards[0];

  return (
    <article>
      {/* Hero */}
      <header className="relative h-[45vh] overflow-hidden md:h-[60vh]">
        <img
          src={project.coverImage}
          alt={project.title}
          width={1200}
          height={630}
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

        <Section heading="Context">
          <p className="text-[var(--color-text-secondary)]">{project.context}</p>
        </Section>

        <Section heading="Idea">
          <p className="text-[var(--color-text-secondary)]">{project.idea}</p>
        </Section>

        <Section heading="Design">
          <p className="text-[var(--color-text-secondary)]">{project.design}</p>
        </Section>

        <Section heading="Inspiration">
          <p className="text-[var(--color-text-secondary)]">{project.inspiration}</p>
        </Section>

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

        <Section heading="Outcome">
          <p className="text-[var(--color-text-secondary)]">{project.outcome}</p>
        </Section>

        <Section heading="Gallery">
          <ImageGallery images={project.gallery} zoomable={project.type === 'static-map'} />
        </Section>

        <Section heading="Stack">
          <StackRow stack={project.stack} />
        </Section>
      </div>
    </article>
  );
}
