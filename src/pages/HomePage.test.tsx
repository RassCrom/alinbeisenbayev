import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { OFFERS, offerHref } from '../data/offers';
import { audience, collaborations, completedProjects } from '../data/proof';
import HomePage from './HomePage';

vi.mock('./WorkDetailPage', () => ({ default: () => null }));

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

it('leads with the headline and one primary action', () => {
  const { getByRole, getAllByRole } = render(<HomePage />, { wrapper });
  expect(getByRole('heading', { level: 1 }).textContent).toBe('Maps that show what data alone cannot.');
  expect(getAllByRole('link', { name: 'Work with me' })[0].getAttribute('href')).toBe('/contact');
});

it('orders the sections', () => {
  const headings = render(<HomePage />, { wrapper })
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent);
  expect(headings).toEqual(['Selected work', 'Clients and collaborations', 'What I can make for you', 'Journal']);
});

it('lists the collaborations and the client-project count from the data', () => {
  const { container, getByText } = render(<HomePage />, { wrapper });
  for (const item of collaborations) {
    expect(getByText(item.name)).toBeTruthy();
    expect(getByText(item.detail)).toBeTruthy();
  }
  expect(getByText('Client projects completed').nextElementSibling?.textContent).toBe(completedProjects);
  expect(container.querySelectorAll('.audience > div')).toHaveLength(audience.length + 1);
});

it('links each offer to the filtered works index', () => {
  const { getByRole } = render(<HomePage />, { wrapper });
  for (const offer of OFFERS) {
    expect(getByRole('link', { name: offer.label }).getAttribute('href')).toBe(offerHref(offer.slug));
  }
});

it('links on to the full works index and the journal', () => {
  const { getByRole } = render(<HomePage />, { wrapper });
  expect(getByRole('link', { name: 'All works' }).getAttribute('href')).toBe('/works');
  expect(getByRole('link', { name: 'All entries' }).getAttribute('href')).toBe('/journal');
});

it('shows three journal entries', () => {
  const { container } = render(<HomePage />, { wrapper });
  expect(container.querySelectorAll('.journal-card')).toHaveLength(3);
});
