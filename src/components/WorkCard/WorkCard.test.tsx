import { act, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { setMedia } from '../../test/setup';
import type { Project } from '../../types';
import WorkCard from './WorkCard';

// The card warms the detail route on hover; the real page is not under test.
vi.mock('../../pages/WorkDetailPage', () => ({ default: () => null }));

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

const project = {
  id: 'p1',
  slug: 'silk-road',
  title: 'Silk Road Through Centuries',
  tagline: 'Print map of the historical trade network',
  status: 'in-progress',
  featured: true,
  type: 'static-map',
  category: 'print',
  offers: ['custom-maps', 'data-journalism'],
  awards: ['Some award'],
  coverImage: '/images/projects/silk-road/preview.webp',
  endDate: '2024-05',
} as unknown as Project;

afterEach(() => {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
});

it('shows the cover, the title and one type line, nothing else', () => {
  const { getByRole, queryByText, container } = render(<WorkCard project={project} />, { wrapper });
  expect(getByRole('link').getAttribute('href')).toBe('/works/silk-road');
  expect(getByRole('heading').textContent).toBe(project.title);
  // The type line is the first offer, not the internal category.
  expect(queryByText('Custom maps')).not.toBeNull();
  expect(queryByText('Print')).toBeNull();
  expect(queryByText('Data journalism')).toBeNull();
  for (const gone of ['★', 'In Progress', 'View case study', project.tagline, '2024', 'Published']) {
    expect(queryByText(gone, { exact: false })).toBeNull();
  }
  expect(container.querySelector('img')!.style.viewTransitionName).toBe('cover-silk-road');
});

it('leaves the type line out for a work nobody has tagged', () => {
  const untagged = { ...project, offers: [] } as Project;
  expect(render(<WorkCard project={untagged} />, { wrapper }).container.querySelector('.t-meta')).toBeNull();
});

it('takes a cover shape from its caller', () => {
  const { container } = render(<WorkCard project={project} ratio="3 / 2" />, { wrapper });
  expect((container.querySelector('img')!.parentElement as HTMLElement).style.aspectRatio).toBe('3 / 2');
});

async function warmAndClick(): Promise<ReturnType<typeof vi.fn>> {
  const start = vi.fn((update: () => void) => {
    update();
    return { ready: Promise.resolve() };
  });
  (document as { startViewTransition?: unknown }).startViewTransition = start;
  const link = render(<WorkCard project={project} />, { wrapper }).getByRole('link');
  fireEvent.pointerEnter(link);
  // Let the mocked route import settle so the card counts as warm.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  fireEvent.click(link);
  return start;
}

it('grows the cover into the page once the route is warm', async () => {
  expect(await warmAndClick()).toHaveBeenCalledTimes(1);
});

it('does not start a view transition with reduced motion', async () => {
  setMedia(['(prefers-reduced-motion: reduce)']);
  expect(await warmAndClick()).not.toHaveBeenCalled();
});
