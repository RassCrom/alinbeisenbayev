import { noteMeta } from '../content/notes-meta';
import { formatDay, formatMonth } from '../utils/date';
import { stories } from './stories';

/** Said once on a card, in plain text: a published piece, a method note, or a tool. */
export type JournalKind = 'Story' | 'Note' | 'Tool';

/** One thing in the journal, as much of it as a card or a link needs. */
export interface JournalEntry {
  slug: string;
  title: string;
  /** A story's standfirst or a note's excerpt. */
  summary: string;
  cover: string;
  kind: JournalKind;
  /** For display: "November 2026" or "7 August 2026". */
  date: string;
  /** Sortable date; larger is newer. */
  when: number;
  href: string;
}

const KINDS: JournalKind[] = ['Story', 'Note', 'Tool'];
const NO_COVER = '/images/placeholder.jpg';

/** The `?kind=` value, if it names a real kind. Any letter case. */
export function parseKind(value: string | null): JournalKind | null {
  return KINDS.find((kind) => kind.toLowerCase() === value?.toLowerCase()) ?? null;
}

/** `YYYY-MM` or `YYYY-MM-DD` as months since year 0, with the day as a fraction. */
function whenOf(date: string): number {
  const [year, month = '12', day = '0'] = date.split('-');
  return Number(year) * 12 + Number(month) + Number(day) / 32;
}

const entry = (fields: Omit<JournalEntry, 'href' | 'when' | 'date'> & { iso: string }): JournalEntry => {
  const { iso, ...rest } = fields;
  return {
    ...rest,
    href: `/journal/${fields.slug}`,
    when: whenOf(iso),
    date: iso.length > 7 ? formatDay(iso) : formatMonth(iso),
  };
};

/**
 * The Map Awards Calendar is a page of its own, not a post, so it has no file
 * to read a title from. Its data is large; none of it is imported here.
 */
const AWARDS_TOOL = entry({
  slug: 'map-awards',
  title: 'Map Awards Calendar',
  summary:
    'Every cartography, GIS and data visualization award on one map, with deadlines, prizes and a calendar feed.',
  cover: '/images/blog/map-awards/cover.jpg',
  kind: 'Tool',
  iso: '2026-11',
});

/** Stories, method notes and tools in one run, newest first. */
export const journalEntries: JournalEntry[] = [
  ...stories.map((story) =>
    entry({
      slug: story.slug,
      title: story.title,
      summary: story.dek,
      cover: story.coverImage,
      kind: 'Story',
      iso: story.date,
    }),
  ),
  ...noteMeta.map((note) =>
    entry({
      slug: note.slug,
      title: note.frontmatter.title,
      summary: note.frontmatter.excerpt,
      cover: note.frontmatter.cover ?? NO_COVER,
      kind: 'Note',
      iso: note.frontmatter.date,
    }),
  ),
  AWARDS_TOOL,
].sort((a, b) => b.when - a.when || a.title.localeCompare(b.title));
