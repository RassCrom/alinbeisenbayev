import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import Button from './Button';

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

it('renders a router link when given `to`', () => {
  const { getByRole } = render(<Button to="/contact">Work with me</Button>, { wrapper });
  expect(getByRole('link').getAttribute('href')).toBe('/contact');
});

it('renders an anchor when given `href`', () => {
  const { getByRole } = render(<Button href="mailto:a@b.c">Mail</Button>, { wrapper });
  expect(getByRole('link').getAttribute('href')).toBe('mailto:a@b.c');
});

it('renders a button otherwise', () => {
  const { getByRole } = render(<Button type="submit">Send</Button>, { wrapper });
  expect(getByRole('button').getAttribute('type')).toBe('submit');
});

it('only the primary variant carries the accent fill class', () => {
  const primary = render(<Button to="/a">A</Button>, { wrapper });
  expect(primary.container.querySelector('a')!.className).toContain('button--primary');
  const quiet = render(<Button to="/b" variant="quiet" icon="arrow-right">B</Button>, { wrapper });
  expect(quiet.container.querySelector('a')!.className).not.toContain('button--primary');
  expect(quiet.container.querySelector('svg')).not.toBeNull();
});
