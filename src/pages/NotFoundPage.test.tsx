import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import NotFoundPage from './NotFoundPage';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NotFoundPage />
    </MemoryRouter>,
  );

afterEach(() => document.head.querySelector('meta[name="robots"]')?.remove());

it('says plainly that the address is not on the site', () => {
  const view = at('/nope');
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Off the edge of the map');
  expect(view.getByText('This address is not on the site. The page may have been renamed or removed.')).not.toBeNull();
});

it('offers three ways back, from any depth', () => {
  for (const path of ['/nope', '/works/no-such-work', '/journal/no-such-entry']) {
    const view = at(path);
    expect(view.getByRole('link', { name: 'See the work' }).getAttribute('href')).toBe('/works');
    expect(view.getByRole('link', { name: 'Read the journal' }).getAttribute('href')).toBe('/journal');
    expect(view.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
    view.unmount();
  }
});

it('invents no readings about the missing page', () => {
  const text = at('/works/no-such-work').container.textContent!;
  expect(text).not.toMatch(/\d+\.\d+°/);
  for (const made of ['Projection', 'Datum', 'Scale', 'Survey', 'Requested position', 'Sheet 404']) {
    expect(text).not.toContain(made);
  }
});

it('asks search engines not to index the miss', () => {
  at('/nope');
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
});
