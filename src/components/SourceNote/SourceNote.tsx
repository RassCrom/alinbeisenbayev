import LocatorInset from '../LocatorInset/LocatorInset';
import type { Project } from '../../types';

export interface SourceNoteProps {
  project: Project;
}

function formatPeriod(startDate: string | null, endDate: string | null): string | null {
  const pretty = (value: string | null): string | null => {
    if (!value) return null;
    if (value === 'Present') return 'present';
    const [year, month] = value.split('-');
    if (!month) return year;
    const date = new Date(Number(year), Number(month) - 1);
    return Number.isNaN(date.getTime())
      ? year
      : date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  const from = pretty(startDate);
  const to = pretty(endDate);
  if (!from && !to) return null;
  if (!from) return to;
  if (!to || from === to) return from;
  return `${from} – ${to}`;
}

/**
 * The block of marginalia a printed sheet carries: who compiled it, from what,
 * in what projection, covering where.
 *
 * Most of it is derived from fields the project already has — period, role,
 * software, extent — so every project gets a note whether or not anyone has
 * filled in `sourceNote`. Projection, datum and data sources appear only when
 * they have been recorded, because inventing them would be worse than leaving
 * them out.
 */
export default function SourceNote({ project }: SourceNoteProps) {
  const { geography, sourceNote } = project;
  const period = formatPeriod(project.startDate, project.endDate);
  const extent = geography.contexts.map((context) => context.label).filter(Boolean);

  const entries: [string, string][] = [];
  if (period) entries.push(['Compiled', period]);
  if (project.role) entries.push(['Author', project.role === 'solo' ? 'Sole author' : 'Team']);
  if (geography.origin?.label) entries.push(['Drawn in', geography.origin.label]);
  if (extent.length > 0) entries.push(['Extent', extent.join('; ')]);
  if (sourceNote?.projection) entries.push(['Projection', sourceNote.projection]);
  if (sourceNote?.datum) entries.push(['Datum', sourceNote.datum]);
  if (project.stack.length > 0) entries.push(['Software', project.stack.join(', ')]);
  if (sourceNote?.sources?.length) entries.push(['Sources', sourceNote.sources.join('; ')]);

  if (entries.length === 0) return null;

  return (
    <aside
      aria-label="Source note"
      className="mt-[var(--space-16)] border-t border-[var(--color-border-default)] pt-[var(--space-6)]"
    >
      <p className="mono-label">Source note</p>

      <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-6)] sm:flex-row sm:items-start sm:gap-[var(--space-8)]">
        <dl className="grid flex-1 grid-cols-1 gap-x-[var(--space-8)] gap-y-[var(--space-3)] sm:grid-cols-2">
          {entries.map(([term, value]) => (
            <div key={term}>
              <dt className="mono-label">{term}</dt>
              <dd className="mt-[2px] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] leading-relaxed text-[var(--color-text-secondary)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {/* The locator: gold marks what the work is about, blue where it was made. */}
        {geography.contexts.length > 0 && (
          <figure className="flex shrink-0 flex-col items-center gap-[var(--space-2)]">
            <LocatorInset contexts={geography.contexts} origin={geography.origin} size={132} />
            <figcaption className="mono-label text-center">Locator</figcaption>
          </figure>
        )}
      </div>

      {sourceNote?.note && (
        <p className="mt-[var(--space-4)] max-w-prose font-[family-name:var(--font-body)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          {sourceNote.note}
        </p>
      )}
    </aside>
  );
}
