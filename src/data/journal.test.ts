import { expect, it } from 'vitest';
import { journalEntries, parseKind } from './journal';
import { stories } from './stories';

it('gives every entry its own address', () => {
  const slugs = journalEntries.map((entry) => entry.slug);
  const repeated = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
  expect(repeated).toEqual([]);
  for (const entry of journalEntries) expect(entry.href).toBe(`/journal/${entry.slug}`);
});

it('runs newest first', () => {
  const whens = journalEntries.map((entry) => entry.when);
  expect(whens).toEqual([...whens].sort((a, b) => b - a));
});

it('carries every published story', () => {
  const storySlugs = journalEntries.filter((entry) => entry.kind === 'Story').map((entry) => entry.slug);
  expect(storySlugs.sort()).toEqual(stories.map((story) => story.slug).sort());
});

it('carries published notes and leaves drafts out', () => {
  const notes = journalEntries.filter((entry) => entry.kind === 'Note').map((entry) => entry.slug);
  expect(notes).toContain('stockholm-metro-guide');
  expect(journalEntries.map((entry) => entry.slug)).not.toContain('getting-started');
});

it('carries the awards calendar as the one tool', () => {
  const tools = journalEntries.filter((entry) => entry.kind === 'Tool');
  expect(tools.map((entry) => entry.slug)).toEqual(['map-awards']);
  expect(tools[0].title).toBe('Map Awards Calendar');
});

it('gives every entry what a card needs', () => {
  for (const entry of journalEntries) {
    expect(entry.title, entry.slug).not.toBe('');
    expect(entry.summary, entry.slug).not.toBe('');
    expect(entry.cover, entry.slug).toMatch(/\.(webp|jpg|jpeg|png)$/);
    expect(entry.date, entry.slug).toMatch(/\d{4}$/);
  }
});

it('reads only known kinds from the address', () => {
  expect(parseKind('NOTE')).toBe('Note');
  expect(parseKind('story')).toBe('Story');
  expect(parseKind('tool')).toBe('Tool');
  expect(parseKind('x')).toBeNull();
  expect(parseKind(null)).toBeNull();
});
