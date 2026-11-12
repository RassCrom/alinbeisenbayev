import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import Nav from './Nav';

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

it('shows the name, three links and one call to action', () => {
  const { getAllByRole, queryByText } = render(<Nav />, { wrapper });
  const links = getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
  expect(links).toContainEqual(['Alikhan Beisenbayev', '/']);
  expect(links).toContainEqual(['Work', '/works']);
  expect(links).toContainEqual(['Journal', '/journal']);
  expect(links).toContainEqual(['About', '/about']);
  expect(links).toContainEqual(['Work with me', '/contact']);
  expect(links).toHaveLength(5);
  for (const gone of ['Gallery', 'Skills', 'Blog', 'Stories', 'Connect']) expect(queryByText(gone)).toBeNull();
});

it('has no theme switch', () => {
  expect(render(<Nav />, { wrapper }).queryByLabelText(/theme/i)).toBeNull();
});

it('opens the phone sheet and closes it on Escape', () => {
  const { getByLabelText, queryByRole } = render(<Nav />, { wrapper });
  expect(queryByRole('dialog')).toBeNull();
  fireEvent.click(getByLabelText('Open menu'));
  expect(queryByRole('dialog')).not.toBeNull();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(queryByRole('dialog')).toBeNull();
});

it('returns focus to the menu button when the sheet closes', () => {
  const { getByLabelText } = render(<Nav />, { wrapper });
  const toggle = getByLabelText('Open menu');
  fireEvent.click(toggle);
  expect(document.activeElement).toBe(getByLabelText('Close menu'));
  fireEvent.click(getByLabelText('Close menu'));
  expect(document.activeElement).toBe(toggle);
});
