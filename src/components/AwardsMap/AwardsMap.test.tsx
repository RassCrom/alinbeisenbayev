import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import AwardsMap from './AwardsMap';
import type { Award, AwardPlace } from '../../data/mapAwards';

beforeAll(() => {
  // jsdom has no canvas; the chart simply isn't drawn.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
});

const places: Record<string, AwardPlace> = {
  almaty: { name: 'Almaty', detail: 'Satbayev University', lat: 43.24, lng: 76.95, role: 'venue' },
  usa: { name: 'United States', detail: 'Online', lat: 39, lng: -98, role: 'organizer', approx: true },
};

const award = (id: string, place: string): Award => ({
  id,
  name: `Award ${id}`,
  org: 'Org',
  kind: 'Map design',
  aud: ['open'],
  region: 'Worldwide',
  place,
  firm: false,
  label: 'TBA',
  prize: '',
  fee: '',
  elig: '',
  need: '',
  note: '',
  url: 'https://example.org',
});

it('draws one ink pin per place, as a button that reads its count and selects the place', () => {
  const onSelect = vi.fn();
  render(
    <AwardsMap
      awards={[award('a', 'almaty'), award('b', 'usa'), award('c', 'usa')]}
      places={places}
      selectedPlace="almaty"
      onSelectPlace={onSelect}
    />,
  );
  const almaty = screen.getByRole('button', { name: /^Almaty, Satbayev University: 1 program$/ });
  expect(almaty.getAttribute('aria-current')).toBe('true');
  expect(almaty.dataset.role).toBe('venue');
  const usa = screen.getByRole('button', { name: /United States, Online: 2 programs, approximate place/ });
  expect(usa.dataset.role).toBe('organizer');
  fireEvent.click(usa);
  expect(onSelect).toHaveBeenCalledWith('usa');
});

it('shows a hover card with the programs when a pin takes focus', () => {
  render(<AwardsMap awards={[award('a', 'almaty')]} places={places} selectedPlace={null} onSelectPlace={() => {}} />);
  fireEvent.focus(screen.getByRole('button', { name: /^Almaty/ }));
  expect(screen.getByRole('tooltip').textContent).toContain('Award a');
});

it('does not select a place while the visitor is placing a new pin', () => {
  const onSelect = vi.fn();
  render(<AwardsMap awards={[award('a', 'almaty')]} places={places} selectedPlace={null} onSelectPlace={onSelect} pickMode />);
  fireEvent.click(screen.getByRole('button', { name: /^Almaty/ }));
  expect(onSelect).not.toHaveBeenCalled();
});

it('folds the key on narrow screens and opens it on request', () => {
  render(<AwardsMap awards={[award('a', 'almaty')]} places={places} selectedPlace={null} onSelectPlace={() => {}} />);
  // jsdom reports a zero-width box, so the key starts folded.
  fireEvent.click(screen.getByRole('button', { name: /Key/ }));
  expect(screen.queryByText('Country only')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hide the key' }));
  expect(screen.queryByText('Country only')).toBeNull();
});
