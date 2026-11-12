import { act, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { OFFERS } from '../data/offers';
import { filterEntries, workEntries } from '../data/works';
import { intersect } from '../test/setup';
import WorksPage from './WorksPage';

// Boundaries this page talks to, not what is under test.
vi.mock('./WorkDetailPage', () => ({ default: () => null }));
vi.mock('./works/WorksMapView', () => ({ default: () => <div data-testid="map-view" /> }));
vi.mock('../components/ImageGallery/Lightbox', () => ({
  default: ({ images, index, onClose }: { images: { caption: string }[]; index: number; onClose: () => void }) => (
    <div role="dialog" aria-label={images[index].caption}>
      <button type="button" onClick={onClose}>
        Close viewer
      </button>
    </div>
  ),
}));

const BATCH = 18;
const at = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <WorksPage />
    </MemoryRouter>,
  );
const cards = (container: HTMLElement) => container.querySelectorAll('.work-card, .piece-card');
const chips = (view: ReturnType<typeof at>) =>
  within(view.getByRole('group', { name: 'Filter by offer' })).getAllByRole('button');
const pressed = (view: ReturnType<typeof at>) =>
  chips(view)
    .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
    .map((chip) => chip.textContent);
const aPiece = workEntries.find((entry) => entry.kind === 'piece')!;

it('is titled Work and offers All plus the five offers', () => {
  const view = at('/works');
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Work');
  expect(chips(view).map((chip) => chip.textContent)).toEqual(['All', ...OFFERS.map((offer) => offer.label)]);
  expect(pressed(view)).toEqual(['All']);
});

it('shows the first batch only', () => {
  expect(workEntries.length).toBeGreaterThan(BATCH);
  expect(cards(at('/works').container)).toHaveLength(BATCH);
});

it('adds a batch when the end of the grid comes into view', () => {
  const view = at('/works');
  act(() => intersect());
  expect(cards(view.container)).toHaveLength(Math.min(BATCH * 2, workEntries.length));
});

it('filters by the offer in the address', () => {
  const view = at('/works?offer=remote-sensing');
  const expected = filterEntries(workEntries, 'remote-sensing', '');
  expect(expected.length).toBeGreaterThan(0);
  expect(pressed(view)).toEqual(['Remote sensing']);
  expect(cards(view.container)).toHaveLength(Math.min(BATCH, expected.length));
});

it('treats an unknown offer as All', () => {
  const view = at('/works?offer=nonsense');
  expect(pressed(view)).toEqual(['All']);
  expect(cards(view.container)).toHaveLength(BATCH);
});

it('switches offer when a chip is pressed, and back with All', () => {
  const view = at('/works');
  fireEvent.click(view.getByRole('button', { name: 'Data journalism' }));
  expect(pressed(view)).toEqual(['Data journalism']);
  expect(cards(view.container)).toHaveLength(Math.min(BATCH, filterEntries(workEntries, 'data-journalism', '').length));
  fireEvent.click(view.getByRole('button', { name: 'All' }));
  expect(pressed(view)).toEqual(['All']);
});

it('filters as the visitor types', () => {
  const view = at('/works');
  fireEvent.change(view.getByLabelText('Search works'), { target: { value: 'silk' } });
  const expected = filterEntries(workEntries, null, 'silk');
  expect(expected.length).toBeGreaterThan(0);
  expect(cards(view.container)).toHaveLength(Math.min(BATCH, expected.length));
});

it('says so when nothing matches, and offers one way back', () => {
  const view = at('/works?q=zzzzzz&offer=remote-sensing');
  expect(cards(view.container)).toHaveLength(0);
  expect(view.getByText('No works match.')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Clear filters' }));
  expect(cards(view.container)).toHaveLength(BATCH);
  expect(pressed(view)).toEqual(['All']);
});

it('opens the piece named in the address', () => {
  const view = at(`/works?item=${aPiece.id}`);
  expect(view.getByRole('dialog').getAttribute('aria-label')).toBe(aPiece.title);
});

it('opens nothing for a piece that does not exist', () => {
  expect(at('/works?item=missing').queryByRole('dialog')).toBeNull();
});

it('opens a piece from its card and closes again', () => {
  const view = at('/works');
  act(() => intersect());
  act(() => intersect());
  act(() => intersect());
  fireEvent.click(view.container.querySelector('.piece-card')!);
  expect(view.queryByRole('dialog')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Close viewer' }));
  expect(view.queryByRole('dialog')).toBeNull();
});

it('loads the map only when it is chosen', async () => {
  const view = at('/works');
  expect(view.queryByTestId('map-view')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Map' }));
  expect(await view.findByTestId('map-view')).not.toBeNull();
  expect(cards(view.container)).toHaveLength(0);
});

it('loads the first card of the grid eagerly and the rest lazily', () => {
  // jsdom matches no media query, so this is the one-column phone layout.
  const images = [...at('/works').container.querySelectorAll<HTMLImageElement>('.works__cell img')];
  expect(images[0].getAttribute('loading')).toBe('eager');
  expect(images.slice(1).every((img) => img.getAttribute('loading') === 'lazy')).toBe(true);
});
