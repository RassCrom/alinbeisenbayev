import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import skillsData from '../data/skills.json';
import projectsData from '../data/projects.json';
import type { SkillsData, SkillLevel, Project, ProjectsData } from '../types';

const { categories, skills } = skillsData as SkillsData;
const { projects } = projectsData as ProjectsData;

const LEVEL_COLOR: Record<SkillLevel, string> = {
  expert: 'var(--color-accent)',
  advanced: 'var(--color-accent-light)',
  intermediate: 'var(--color-text-secondary)',
  learning: 'var(--color-text-muted)',
};

/**
 * Match a project stack entry against a skill name. Exact match always wins;
 * substring matches need ≥3 chars so "Rust" never matches the stack entry "R".
 */
function stackMatches(stackItem: string, skillName: string): boolean {
  const a = stackItem.toLowerCase();
  const b = skillName.toLowerCase();
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.includes(shorter);
}

interface RelatedWork {
  projects: Project[];
  /** stack term used for the /works?q= deep link */
  term: string;
}

interface HoverPreview {
  skillId: string;
  project: Project;
  moreCount: number;
}

export default function SkillsPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<HoverPreview | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const relatedBySkill = useMemo(() => {
    const map = new Map<string, RelatedWork>();
    skills.forEach((skill) => {
      const matched: Project[] = [];
      let term: string | null = null;
      projects.forEach((project) => {
        const hit = project.stack.find((s) => stackMatches(s, skill.name));
        if (hit) {
          matched.push(project);
          if (!term) term = hit;
        }
      });
      if (matched.length > 0 && term) map.set(skill.id, { projects: matched, term });
    });
    return map;
  }, []);

  // Keep the floating card inside the viewport
  const previewLeft = Math.min(cursor.x + 20, window.innerWidth - 250);
  const previewTop = Math.min(Math.max(cursor.y, 130), window.innerHeight - 130);

  return (
    <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-12)]">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
        Skills
      </h1>

      {categories.map((category) => {
        const items = skills.filter((skill) => skill.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="mt-[var(--space-12)]">
            <h2 className="heading-section">{category}</h2>
            <div className="mt-[var(--space-6)] grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
              {items.map((skill) => {
                const related = relatedBySkill.get(skill.id);
                const interactive = Boolean(related);
                return (
                  <div
                    key={skill.id}
                    role={interactive ? 'link' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onClick={
                      interactive
                        ? () => navigate(`/works?q=${encodeURIComponent(related!.term)}`)
                        : undefined
                    }
                    onKeyDown={
                      interactive
                        ? (e) => {
                            if (e.key === 'Enter') {
                              navigate(`/works?q=${encodeURIComponent(related!.term)}`);
                            }
                          }
                        : undefined
                    }
                    onMouseEnter={
                      interactive
                        ? () =>
                            setPreview({
                              skillId: skill.id,
                              project: related!.projects[0],
                              moreCount: related!.projects.length - 1,
                            })
                        : undefined
                    }
                    onMouseMove={
                      interactive ? (e) => setCursor({ x: e.clientX, y: e.clientY }) : undefined
                    }
                    onMouseLeave={interactive ? () => setPreview(null) : undefined}
                    className={`flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[image:var(--gradient-card)] p-[var(--space-4)] ${
                      interactive
                        ? 'cursor-none transition-colors hover:border-[var(--color-accent)]'
                        : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-[var(--space-3)]">
                      {skill.iconType === 'image' && skill.iconUrl && (
                        <img
                          src={skill.iconUrl}
                          alt=""
                          width={28}
                          height={28}
                          loading="lazy"
                          className="h-7 w-7 shrink-0"
                        />
                      )}
                      <span className="truncate font-[family-name:var(--font-heading)] font-semibold">
                        {skill.name}
                      </span>
                    </div>
                    <span
                      className="shrink-0 rounded-[var(--radius-full)] border px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]"
                      style={{ color: LEVEL_COLOR[skill.level], borderColor: LEVEL_COLOR[skill.level] }}
                    >
                      {skill.level}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Cursor-following project preview (skills with related works only) */}
      {preview && (
        <div
          key={preview.skillId}
          aria-hidden="true"
          className="pointer-events-none fixed z-[var(--z-modal)] animate-[preview-pop_180ms_ease-out_both]"
          style={{ left: previewLeft, top: previewTop, transform: 'translateY(-50%)' }}
        >
          <div className="w-[230px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] shadow-[var(--shadow-elevated)]">
            <img
              src={preview.project.coverImage}
              alt={preview.project.title}
              width={1200}
              height={630}
              className="aspect-video w-full object-cover"
            />
            <div className="p-[var(--space-3)]">
              <p className="truncate font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] font-bold">
                {preview.project.title}
              </p>
              {preview.moreCount > 0 && (
                <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  +{preview.moreCount} more related {preview.moreCount === 1 ? 'work' : 'works'}
                </p>
              )}
              <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-light)]">
                Click → related works
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
