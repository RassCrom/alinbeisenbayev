import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import ContactBand, { showContactBand } from './ContactBand';

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

it('hides the band where it would repeat the page', () => {
  for (const path of ['/contact', '/connect', '/journal/map-awards', '/blog/map-awards']) {
    expect(showContactBand(path)).toBe(false);
  }
  for (const path of ['/', '/works', '/works/silk-road', '/about', '/journal']) {
    expect(showContactBand(path)).toBe(true);
  }
});

it('says what it is and offers the one action', () => {
  const { getByRole } = render(<ContactBand />, { wrapper });
  expect(getByRole('heading', { level: 2 }).textContent).toBe('Start a project');
  expect(getByRole('link', { name: 'Work with me' }).getAttribute('href')).toBe('/contact');
});
