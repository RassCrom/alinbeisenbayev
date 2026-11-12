import { useSearchParams } from 'react-router-dom';
import FilterChip from '../components/FilterChip/FilterChip';
import JournalCard from '../components/JournalCard/JournalCard';
import { journalEntries, parseKind, type JournalKind } from '../data/journal';
import { usePageMeta } from '../hooks/usePageMeta';

const KIND_CHIPS: { kind: JournalKind; label: string }[] = [
  { kind: 'Story', label: 'Stories' },
  { kind: 'Note', label: 'Notes' },
  { kind: 'Tool', label: 'Tools' },
];

/**
 * Everything written or published, in one run: the stories, the notes on how
 * they were made, and the tools that came out of the work.
 */
export default function JournalPage() {
  usePageMeta('Journal', 'Map stories, notes on how they were made, and tools, by Alikhan Beisenbayev.');

  // The filter lives in the address so a filtered view can be shared.
  const [params, setParams] = useSearchParams();
  const kind = parseKind(params.get('kind'));
  const choose = (next: JournalKind | null) => {
    const updated = new URLSearchParams(params);
    if (next) updated.set('kind', next.toLowerCase());
    else updated.delete('kind');
    setParams(updated, { replace: true });
  };

  const visible = kind ? journalEntries.filter((entry) => entry.kind === kind) : journalEntries;
  const [lead, ...rest] = visible;

  return (
    <div className="journal wrap">
      <h1 className="t-display journal__title">Journal</h1>

      <div className="works__filters" role="group" aria-label="Filter by kind">
        <FilterChip pressed={kind === null} onClick={() => choose(null)}>
          All
        </FilterChip>
        {KIND_CHIPS.map((chip) => (
          <FilterChip key={chip.kind} pressed={kind === chip.kind} onClick={() => choose(chip.kind)}>
            {chip.label}
          </FilterChip>
        ))}
      </div>

      {lead ? (
        <>
          <div className="journal__lead">
            <JournalCard
              key={lead.slug}
              size="lead"
              title={lead.title}
              href={lead.href}
              cover={lead.cover}
              kind={lead.kind}
              date={lead.date}
              summary={lead.summary}
            />
          </div>
          {rest.length > 0 && (
            <div className="journal-grid journal__rest">
              {rest.map((entry) => (
                <JournalCard
                  key={entry.slug}
                  title={entry.title}
                  href={entry.href}
                  cover={entry.cover}
                  kind={entry.kind}
                  date={entry.date}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="journal__empty">Nothing here yet.</p>
      )}
    </div>
  );
}
