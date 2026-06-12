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

const LEVEL_SYMBOL: Record<string, string> = {
  expert: '◆',
  advanced: '●',
  intermediate: '○',
  learning: '◌',
};

const LEVEL_SYMBOL_COLOR: Record<string, string> = {
  expert: 'var(--color-accent-gold)',
  advanced: 'var(--color-accent-light)',
  intermediate: 'var(--color-text-secondary)',
  learning: 'var(--color-text-muted)',
};

const LEGEND_KEY = [
  { sym: '◆', col: 'var(--color-accent-gold)',      label: 'Expert' },
  { sym: '●', col: 'var(--color-accent-light)',     label: 'Advanced' },
  { sym: '○', col: 'var(--color-text-secondary)',   label: 'Intermediate' },
  { sym: '◌', col: 'var(--color-text-muted)',       label: 'Learning' },
];

function stackMatches(stackItem: string, skillName: string): boolean {
  const a = stackItem.toLowerCase();
  const b = skillName.toLowerCase();
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.includes(shorter);
}

interface RelatedWork {
  projects: Project[];
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

  const previewLeft = Math.min(cursor.x + 20, window.innerWidth - 250);
  const previewTop = Math.min(Math.max(cursor.y, 130), window.innerHeight - 130);

  return (
    <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-12)]">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
        Skills
      </h1>

      {/* Symbol key */}
      <div className="legend-key">
        {LEGEND_KEY.map((entry, i) => (
          <span key={entry.label} className="flex items-center gap-1">
            <span style={{ color: entry.col }} className="font-[family-name:var(--font-mono)]">
              {entry.sym}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
              {entry.label}
            </span>
            {i < LEGEND_KEY.length - 1 && (
              <span className="legend-key__sep mx-[var(--space-1)]">·</span>
            )}
          </span>
        ))}
      </div>

      {/* Legend panels grid */}
      <div className="mt-[var(--space-8)] grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2">
        {categories.map((category) => {
          const items = skills.filter((skill) => skill.category === category);
          if (items.length === 0) return null;
          return (
            <div
              key={category}
              className={`legend-panel${category === 'Cartography & Design' ? ' topo-card' : ''}`}
            >
              <div className="legend-panel__header">{category}</div>
              <div className="legend-panel__body">
                {items.map((skill) => {
                  const related = relatedBySkill.get(skill.id);
                  const interactive = Boolean(related);
                  const sym      = LEVEL_SYMBOL[skill.level]      ?? '◌';
                  const symColor = LEVEL_SYMBOL_COLOR[skill.level] ?? 'var(--color-text-muted)';
                  const lvlColor = LEVEL_COLOR[skill.level as SkillLevel] ?? 'var(--color-text-muted)';
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
                      className={`legend-row${interactive ? ' legend-row--interactive' : ''}`}
                    >
                      <span className="legend-row__symbol" style={{ color: symColor }}>
                        {sym}
                      </span>
                      <span className="legend-row__name">{skill.name}</span>
                      <span className="legend-row__level" style={{ color: lvlColor }}>
                        {skill.level}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
