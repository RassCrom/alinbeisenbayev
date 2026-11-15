import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { socials } from '../data/socials';
import ContactPage from './ContactPage';

const at = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ContactPage />
    </MemoryRouter>,
  );
const pressed = (view: ReturnType<typeof at>) =>
  within(view.getByRole('group', { name: /What you need/ }))
    .getAllByRole('button')
    .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
    .map((chip) => chip.textContent);
const address = socials.find((social) => social.platform === 'Email')!.label;

it('is titled Work with me and says what happens next', () => {
  const view = at('/contact');
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Work with me');
  expect(view.getByText('Send a few lines about what you need.')).not.toBeNull();
  expect(view.getByText('I reply by email to talk through scope and timing.')).not.toBeNull();
});

it('gives the direct address as the other way in', () => {
  const link = at('/contact').getByRole('link', { name: address });
  expect(link.getAttribute('href')).toBe(`mailto:${address}`);
});

it('holds the form', () => {
  const view = at('/contact');
  expect(view.container.querySelector('form')).not.toBeNull();
  expect(pressed(view)).toEqual([]);
});

it('opens with the offer the visitor came for', () => {
  expect(pressed(at('/contact?offer=remote-sensing'))).toEqual(['Remote sensing']);
});

it('ignores an offer it does not know', () => {
  expect(pressed(at('/contact?offer=nonsense'))).toEqual([]);
});

it('shows the client logos and the pieces made for them', () => {
  const view = at('/contact');
  const section = within(view.getByRole('region', { name: 'Trusted by' }));
  for (const name of ['Lichess.org', 'Europe Magazine', 'IFME', 'Vlast.kz', 'The Times of Central Asia'])
    expect(section.getByRole('img', { name })).not.toBeNull();
  expect(section.getByText('Which country has the most chess players?')).not.toBeNull();
  expect(section.getByRole('link', { name: /Berlin metro/ })).not.toBeNull();
});
