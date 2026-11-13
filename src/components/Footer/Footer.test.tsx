import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { NAV_LINKS } from '../Nav/Nav';
import Footer from './Footer';

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

it('carries the nav links and the year', () => {
  const { getByRole, getByText } = render(<Footer />, { wrapper });
  for (const link of NAV_LINKS) {
    expect(getByRole('link', { name: link.label }).getAttribute('href')).toBe(link.to);
  }
  expect(getByText(new RegExp(String(new Date().getFullYear())))).not.toBeNull();
});

it('has none of the old map-margin labels', () => {
  const { queryByText } = render(<Footer />, { wrapper });
  for (const gone of ['Legend', 'Sources', 'Cartographer', 'Edition', 'Role']) expect(queryByText(gone)).toBeNull();
});

it('links to nothing that has been folded into another page', () => {
  const { queryByRole } = render(<Footer />, { wrapper });
  for (const gone of ['Blog', 'Gallery', 'Stories', 'Skills']) expect(queryByRole('link', { name: gone })).toBeNull();
});

it('opens outside profiles in a new tab', () => {
  const { container } = render(<Footer />, { wrapper });
  const outside = [...container.querySelectorAll('a[href^="http"]')];
  expect(outside.length).toBeGreaterThan(0);
  for (const a of outside) expect(a.getAttribute('target')).toBe('_blank');
});

it('ends with the call to action, over the field camp', () => {
  const { getByRole, container } = render(<Footer scene />, { wrapper });
  expect(getByRole('heading', { level: 2 }).textContent).toBe('Start a project');
  const cta = getByRole('link', { name: 'Work with me' });
  expect(cta.getAttribute('href')).toBe('/contact');
  expect(cta.className).toContain('button--primary');
  // Inside the scene, so the drawing and the offer read as one thing.
  expect(cta.closest('.footer__scene')).not.toBeNull();
  expect(container.querySelector('.footer__scene .field-camp')).not.toBeNull();
});

it('drops the call to action where the page already is one', () => {
  const { queryByRole, container } = render(<Footer cta={false} scene />, { wrapper });
  expect(queryByRole('link', { name: 'Work with me' })).toBeNull();
  expect(queryByRole('heading', { level: 2 })).toBeNull();
  // The drawing stays.
  expect(container.querySelector('.field-camp')).not.toBeNull();
});

it('brings the drawing in after the page, into a box already its shape', async () => {
  const { container } = render(<Footer scene />, { wrapper });
  // At first: the placeholder box, so the footer's height is already right.
  expect(container.querySelector('.footer__scene .field-camp')).not.toBeNull();
  // Then the drawing itself.
  await waitFor(() => expect(container.querySelector('svg.field-camp')).not.toBeNull());
  expect(container.querySelectorAll('.field-camp')).toHaveLength(1);
});

it('keeps the drawing hidden for now, and the call to action showing', () => {
  const { container, getByRole } = render(<Footer />, { wrapper });
  expect(container.querySelector('.field-camp')).toBeNull();
  expect(getByRole('link', { name: 'Work with me' }).getAttribute('href')).toBe('/contact');
});
