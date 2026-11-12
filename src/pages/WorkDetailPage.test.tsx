import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it } from 'vitest';
import { allProjects } from '../data/projects';
import type { Project } from '../types';
import WorkDetailPage, { layoutFor } from './WorkDetailPage';

const at = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/works/${slug}`]}>
      <Routes>
        <Route path="/works/:slug" element={<WorkDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
const bySlug = (slug: string) => allProjects.find((project) => project.slug === slug)!;
const h2s = (view: ReturnType<typeof at>) => view.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);

const step = { step: 1, title: 'Sketch', description: 'Drew it.' };
const fixture = (fields: Partial<Project>) => ({ context: '', outcome: '', process: [], ...fields }) as Project;

it('gives the full layout only to a work with context, process and outcome', () => {
  expect(layoutFor(fixture({ context: 'c', outcome: 'o', process: [step] }))).toBe('full');
  expect(layoutFor(fixture({ context: 'c', outcome: 'o' }))).toBe('short');
  expect(layoutFor(fixture({ context: 'c', process: [step] }))).toBe('short');
  expect(layoutFor(fixture({ outcome: 'o', process: [step] }))).toBe('short');
  // A step with nothing written in it is not a process.
  expect(layoutFor(fixture({ context: 'c', outcome: 'o', process: [{ step: 1, title: ' ', description: '' }] }))).toBe('short');
});

it('shows the not-found page for a slug nobody has', () => {
  expect(at('no-such-work').getByRole('heading', { level: 1 }).textContent).toBe('Off the edge of the map');
});

it('leads a full work with its cover and tells it in sections', () => {
  expect(layoutFor(bySlug('silk-road'))).toBe('full');
  const view = at('silk-road');
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe(bySlug('silk-road').title);
  const cover = view.container.querySelector('img')!;
  expect(cover.getAttribute('src')).toBe(bySlug('silk-road').coverImage);
  expect(cover.style.viewTransitionName).toBe('cover-silk-road');
  expect(cover.getAttribute('loading')).toBe('eager');
  expect(h2s(view)).toEqual(expect.arrayContaining(['Context', 'Process', 'Outcome']));
  expect(h2s(view)).not.toContain('About this work');
});

it('keeps a short work short: its text under one heading, no sections', () => {
  expect(layoutFor(bySlug('tropical-night'))).toBe('short');
  const view = at('tropical-night');
  expect(h2s(view)).toContain('About this work');
  for (const gone of ['Context', 'Idea', 'Design', 'Process', 'Outcome']) expect(h2s(view)).not.toContain(gone);
});

it('still makes a page of a work with no media and no text', () => {
  const project = bySlug('historical-vienna');
  const view = at('historical-vienna');
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe(project.title);
  expect(view.container.querySelector(`img[src="${project.coverImage}"]`)).not.toBeNull();
  expect(h2s(view)).not.toContain('About this work');
  expect(view.getByRole('link', { name: 'Work with me' })).not.toBeNull();
});

it('states the facts in plain text: no stars, no badges', () => {
  const project = bySlug('silk-road');
  const view = at('silk-road');
  expect(view.getByText('Role')).not.toBeNull();
  expect(view.getByText(project.role)).not.toBeNull();
  expect(view.getByText(project.awards.join('; '))).not.toBeNull();
  expect(view.container.textContent).not.toContain('★');
  expect(view.container.querySelector('.meta-pill')).toBeNull();
  expect(view.container.querySelector('.section-eyebrow')).toBeNull();
});

it('ends by offering work of the same kind', () => {
  const project = bySlug('silk-road');
  const view = at('silk-road');
  expect(h2s(view)).toContain('Work with me on something like this');
  expect(view.getByRole('link', { name: 'Work with me' }).getAttribute('href')).toBe(
    `/contact?offer=${project.offers[0]}`,
  );
});

it('suggests two other works', () => {
  const view = at('silk-road');
  const cards = view.container.querySelectorAll('.work-card');
  expect(cards).toHaveLength(2);
  for (const card of cards) expect(card.getAttribute('href')).not.toBe('/works/silk-road');
});

it('opens outside links in a new tab', () => {
  const withLive = allProjects.find((project) => project.liveUrl && project.type === 'website')!;
  const view = at(withLive.slug);
  for (const link of view.container.querySelectorAll('a[href^="http"]')) {
    expect(link.getAttribute('target'), link.getAttribute('href')!).toBe('_blank');
  }
});
