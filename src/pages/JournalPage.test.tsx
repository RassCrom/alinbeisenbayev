import { fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { journalEntries } from '../data/journal';
import JournalPage from './JournalPage';

const at = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <JournalPage />
    </MemoryRouter>,
  );
const cards = (view: ReturnType<typeof at>) => [...view.container.querySelectorAll('.journal-card')];
const chips = (view: ReturnType<typeof at>) =>
  within(view.getByRole('group', { name: 'Filter by kind' })).getAllByRole('button');
const pressed = (view: ReturnType<typeof at>) =>
  chips(view)
    .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
    .map((chip) => chip.textContent);
const count = (kind: string) => journalEntries.filter((entry) => entry.kind === kind).length;

it('is titled Journal and lists everything by default', () => {
  const view = at('/journal');
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Journal');
  expect(chips(view).map((chip) => chip.textContent)).toEqual(['All', 'Stories', 'Notes', 'Tools']);
  expect(pressed(view)).toEqual(['All']);
  expect(cards(view)).toHaveLength(journalEntries.length);
});

it('links every card to its journal address', () => {
  const hrefs = cards(at('/journal')).map((card) => card.getAttribute('href'));
  expect(hrefs).toEqual(journalEntries.map((entry) => entry.href));
});

it('gives the newest entry the lead, with its summary', () => {
  const view = at('/journal');
  const [lead, ...rest] = cards(view);
  expect(lead.className).toContain('journal-card--lead');
  expect(lead.textContent).toContain(journalEntries[0].summary);
  for (const card of rest) expect(card.className).not.toContain('journal-card--lead');
  expect(rest[0].textContent).not.toContain(journalEntries[1].summary);
});

it('says each kind and date once on its card', () => {
  const first = journalEntries[0];
  expect(cards(at('/journal'))[0].textContent).toContain(`${first.kind}, ${first.date}`);
});

it('filters by the kind in the address', () => {
  const view = at('/journal?kind=note');
  expect(pressed(view)).toEqual(['Notes']);
  expect(cards(view)).toHaveLength(count('Note'));
});

it('treats an unknown kind as All', () => {
  const view = at('/journal?kind=nonsense');
  expect(pressed(view)).toEqual(['All']);
  expect(cards(view)).toHaveLength(journalEntries.length);
});

it('switches kind when a chip is pressed', () => {
  const view = at('/journal');
  fireEvent.click(view.getByRole('button', { name: 'Tools' }));
  expect(pressed(view)).toEqual(['Tools']);
  expect(cards(view).map((card) => card.getAttribute('href'))).toEqual(['/journal/map-awards']);
  fireEvent.click(view.getByRole('button', { name: 'All' }));
  expect(cards(view)).toHaveLength(journalEntries.length);
});
