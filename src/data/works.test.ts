import { expect, it } from 'vitest';
import { galleryItems } from './gallery';
import { OFFERS, type OfferSlug } from './offers';
import { allProjects, projects } from './projects';
import { distribute, filterEntries, firstOfferLabel, parseOffer, workEntries, type WorkEntry } from './works';

const SLUGS = OFFERS.map((offer) => offer.slug);

it('gives every listed project at least one valid offer', () => {
  for (const project of projects) {
    expect(project.offers?.length ?? 0, project.slug).toBeGreaterThan(0);
    for (const offer of project.offers) expect(SLUGS, project.slug).toContain(offer);
  }
});

it('names any gallery piece still waiting for an offer', () => {
  expect(galleryItems.filter((item) => !item.offers?.length).map((item) => item.id)).toEqual([]);
  for (const item of galleryItems) for (const offer of item.offers ?? []) expect(SLUGS, item.id).toContain(offer);
});

it('points every workSlug at a real project', () => {
  const slugs = allProjects.map((project) => project.slug);
  for (const item of galleryItems) if (item.workSlug) expect(slugs, item.id).toContain(item.workSlug);
});

it('lists projects and unlinked pieces together, newest first', () => {
  expect(workEntries.some((entry) => entry.kind === 'project')).toBe(true);
  expect(workEntries.some((entry) => entry.kind === 'piece')).toBe(true);
  expect(workEntries.filter((entry) => entry.kind === 'piece' && entry.item.workSlug)).toEqual([]);
  const whens = workEntries.map((entry) => entry.when);
  expect(whens).toEqual([...whens].sort((a, b) => b - a));
});

it('has no two entries with one id', () => {
  const ids = workEntries.map((entry) => entry.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it('reserves a sane shape for every card', () => {
  for (const entry of workEntries) {
    expect(entry.ratio, entry.id).toBeGreaterThanOrEqual(0.7);
    expect(entry.ratio, entry.id).toBeLessThanOrEqual(1.78);
    expect(entry.cover, entry.id).toMatch(/\.(webp|jpg|jpeg|png)$/);
  }
});

it('filters by offer and by text', () => {
  const entry = (id: string, offers: OfferSlug[], search: string) => ({ id, offers, search }) as WorkEntry;
  const list = [
    entry('a', ['custom-maps'], 'silk road print'),
    entry('b', ['remote-sensing'], 'fires europe'),
    entry('c', [], 'untagged'),
  ];
  expect(filterEntries(list, 'remote-sensing', '').map((x) => x.id)).toEqual(['b']);
  expect(filterEntries(list, null, ' SILK ').map((x) => x.id)).toEqual(['a']);
  // An entry nobody has tagged yet is still reachable under All.
  expect(filterEntries(list, null, '').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  expect(filterEntries(list, 'custom-maps', 'fires')).toEqual([]);
});

it('reads only known offers from the URL', () => {
  expect(parseOffer('remote-sensing')).toBe('remote-sensing');
  expect(parseOffer('nonsense')).toBeNull();
  expect(parseOffer(null)).toBeNull();
});

it('fills the shortest column and never moves earlier entries', () => {
  const card = (ratio: number, id: number) => ({ ratio, id });
  const list = [card(1, 1), card(0.5, 2), card(1, 3), card(1, 4)]; // heights 1, 2, 1, 1
  const ids = (columns: { id: number }[][]) => columns.map((column) => column.map((x) => x.id));
  expect(ids(distribute(list, 2))).toEqual([[1, 3, 4], [2]]);
  expect(ids(distribute(list.slice(0, 3), 2))).toEqual([[1, 3], [2]]);
  expect(ids(distribute(list, 1))).toEqual([[1, 2, 3, 4]]);
});

it('labels a card by its first offer', () => {
  expect(firstOfferLabel(['data-journalism', 'custom-maps'])).toBe('Data journalism');
  expect(firstOfferLabel([])).toBe('');
});
