import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import ContactBand, { showContactBand } from './ContactBand';

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

it('hides the band where it would repeat the page', () => {
  // A work page places its own band, worded for that work.
  for (const path of ['/contact', '/connect', '/journal/map-awards', '/blog/map-awards', '/works/silk-road']) {
    expect(showContactBand(path)).toBe(false);
  }
  for (const path of ['/', '/works', '/about', '/journal']) {
    expect(showContactBand(path)).toBe(true);
  }
});

it('says what it is and offers the one action', () => {
  const { getByRole } = render(<ContactBand />, { wrapper });
  expect(getByRole('heading', { level: 2 }).textContent).toBe('Start a project');
  expect(getByRole('link', { name: 'Work with me' }).getAttribute('href')).toBe('/contact');
});

it('can be worded for one work and carry its offer to the form', () => {
  const { getByRole } = render(<ContactBand heading="Work with me on something like this" offer="remote-sensing" />, {
    wrapper,
  });
  expect(getByRole('heading', { level: 2 }).textContent).toBe('Work with me on something like this');
  expect(getByRole('link', { name: 'Work with me' }).getAttribute('href')).toBe('/contact?offer=remote-sensing');
});
