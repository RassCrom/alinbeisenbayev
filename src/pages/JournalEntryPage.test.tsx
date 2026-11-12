import { render } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import ChapterNav from '../components/ChapterNav/ChapterNav';
import { stories } from '../data/stories';
import JournalEntryPage from './JournalEntryPage';

vi.mock('./WorkDetailPage', () => ({ default: () => null }));

const at = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/journal/${slug}`]}>
      <Routes>
        <Route path="/journal/:slug" element={<JournalEntryPage />} />
      </Routes>
    </MemoryRouter>,
  );
const story = (slug: string) => stories.find((s) => s.slug === slug)!;
const NOT_FOUND = 'Off the edge of the map';

it('is the piece itself for a story written in the repo', () => {
  const view = at('saint-lucia');
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe(story('saint-lucia').title);
  expect(view.container.querySelector('.mdx-prose')!.textContent!.length).toBeGreaterThan(200);
  expect(view.queryByRole('link', { name: 'Read the story' })).toBeNull();
});

it('hands the reader on for a story published elsewhere', () => {
  const external = story('tigranes-the-greatest');
  expect(external.external).toBe(true);
  const view = at('tigranes-the-greatest');
  const read = view.getByRole('link', { name: 'Read the story' });
  expect(read.getAttribute('href')).toBe(external.url);
  expect(read.getAttribute('target')).toBe('_blank');
  expect(view.container.querySelector('.mdx-prose')).toBeNull();
});

it('links a story to the work about making it', () => {
  const view = at('tigranes-the-greatest');
  expect(view.getByRole('link', { name: 'How it was made' }).getAttribute('href')).toBe(
    '/works/tigranes-the-greatest',
  );
});

it('leads with the cover and signs the story', () => {
  const piece = story('saint-lucia');
  const view = at('saint-lucia');
  const cover = view.container.querySelector('img')!;
  expect(cover.getAttribute('src')).toBe(piece.coverImage);
  expect(cover.getAttribute('loading')).toBe('eager');
  expect(view.container.textContent).toContain(`By ${piece.byline[0]}`);
});

it('renders a note with its body and the work it explains', () => {
  const view = at('stockholm-metro-guide');
  expect(view.getByRole('heading', { level: 1 }).textContent).toContain('Stockholm Metro Guide');
  expect(view.container.querySelector('.mdx-prose')!.textContent!.length).toBeGreaterThan(200);
  expect(view.container.querySelector('.work-card')!.getAttribute('href')).toBe('/works/metro-animation');
});

it('shows the not-found page for a draft and for a slug nobody has', () => {
  for (const slug of ['getting-started', 'no-such-entry']) {
    const view = at(slug);
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(NOT_FOUND);
    view.unmount();
  }
});

it('offers two more entries, never the one being read', () => {
  const view = at('saint-lucia');
  const more = [...view.container.querySelectorAll('.journal-card')].map((card) => card.getAttribute('href'));
  expect(more).toHaveLength(2);
  expect(more).not.toContain('/journal/saint-lucia');
});

it('carries no stars, no pills and no link to the old addresses', () => {
  for (const slug of ['saint-lucia', 'tigranes-the-greatest', 'stockholm-metro-guide']) {
    const view = at(slug);
    expect(view.container.textContent, slug).not.toContain('★');
    expect(view.container.querySelector('.meta-pill'), slug).toBeNull();
    for (const link of view.container.querySelectorAll('a')) {
      expect(link.getAttribute('href'), slug).not.toMatch(/^\/(stories|blog)(\/|$)/);
    }
    view.unmount();
  }
});

function Chapters({ headings }: { headings: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <ChapterNav containerRef={ref} />
      <div ref={ref}>
        {headings.map((text) => (
          <h2 key={text} id={text.toLowerCase()}>
            {text}
          </h2>
        ))}
      </div>
    </>
  );
}

it('lists a page’s chapters when there are at least two', () => {
  const view = render(<Chapters headings={['Data', 'Method', 'Result']} />);
  const links = [...view.getByRole('navigation', { name: 'On this page' }).querySelectorAll('a')];
  expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['Data', '#data'],
    ['Method', '#method'],
    ['Result', '#result'],
  ]);
});

it('shows no chapter list for a single chapter', () => {
  expect(render(<Chapters headings={['Only']} />).queryByRole('navigation')).toBeNull();
});

it('sets the reading column in the centre of the page', () => {
  const view = at('saint-lucia');
  for (const selector of ['.entry__cover', '.entry__head', '.entry__body']) {
    const block = view.container.querySelector(selector);
    expect(block, selector).not.toBeNull();
    expect(block!.classList.contains('column'), selector).toBe(true);
    expect(block!.classList.contains('wrap'), selector).toBe(false);
  }
});
