import type { Project } from '../../types';
import { formatMonth } from '../../utils/date';

export interface SourceNoteProps {
  project: Project;
}

function formatPeriod(startDate: string | null, endDate: string | null): string | null {
  const pretty = (value: string | null): string | null => (value ? formatMonth(value, 'short') : null);

  const from = pretty(startDate);
  const to = pretty(endDate);
  if (!from && !to) return null;
  if (!from) return to;
  if (!to || from === to) return from;
  return `${from} – ${to}`;
}

/**
 * The marginalia a printed map carries: when it was compiled, where, covering
 * what, in what projection, from which sources.
 *
 * Period, place and extent are derived from fields the project already has.
 * Projection, datum and data sources appear only when they have been
 * recorded, because inventing them would be worse than leaving them out.
 * Role and tools are not repeated here; the facts at the top of the page
 * already state them.
 */
export default function SourceNote({ project }: SourceNoteProps) {
  const { geography, sourceNote } = project;
  const period = formatPeriod(project.startDate, project.endDate);
  const extent = geography.contexts.map((context) => context.label).filter(Boolean);

  const entries: [string, string][] = [];
  if (period) entries.push(['Compiled', period]);
  if (geography.origin?.label) entries.push(['Drawn in', geography.origin.label]);
  if (extent.length > 0) entries.push(['Extent', extent.join('; ')]);
  if (sourceNote?.projection) entries.push(['Projection', sourceNote.projection]);
  if (sourceNote?.datum) entries.push(['Datum', sourceNote.datum]);
  if (sourceNote?.sources?.length) entries.push(['Sources', sourceNote.sources.join('; ')]);

  if (entries.length === 0) return null;

  return (
    <aside id="source-note" aria-labelledby="source-note-heading" className="source-note">
      <h2 id="source-note-heading" className="t-h3">
        Source note
      </h2>
      <dl className="facts">
        {entries.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {sourceNote?.note && <p className="t-meta">{sourceNote.note}</p>}
    </aside>
  );
}
