import { render } from '@testing-library/react';
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

it('keeps Gallery and Blog reachable until they are folded in', () => {
  const { getByRole } = render(<Footer />, { wrapper });
  expect(getByRole('link', { name: 'Gallery' }).getAttribute('href')).toBe('/gallery');
  expect(getByRole('link', { name: 'Blog' }).getAttribute('href')).toBe('/blog');
});

it('opens outside profiles in a new tab', () => {
  const { container } = render(<Footer />, { wrapper });
  const outside = [...container.querySelectorAll('a[href^="http"]')];
  expect(outside.length).toBeGreaterThan(0);
  for (const a of outside) expect(a.getAttribute('target')).toBe('_blank');
});
