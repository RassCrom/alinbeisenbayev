import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { gtaV, gtaViDay, gtaViNight } from '../../data/gta-palettes';
import Palette, { paletteText } from './Palette';

afterEach(() => vi.restoreAllMocks());

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

it('copies a swatch hex on click and says so', async () => {
  const writeText = mockClipboard();
  const view = render(<Palette palette={gtaViDay} />);
  const land = view.getByRole('button', { name: 'Copy Land #C6D682' });
  await act(async () => fireEvent.click(land));
  expect(writeText).toHaveBeenCalledWith('#C6D682');
  expect(land.textContent).toContain('Copied');
});

it('copies a sea stop', async () => {
  const writeText = mockClipboard();
  const view = render(<Palette palette={gtaViDay} />);
  await act(async () => fireEvent.click(view.getByRole('button', { name: 'Copy sea at 150 px #2064B4' })));
  expect(writeText).toHaveBeenCalledWith('#2064B4');
});

it('copies the whole palette as one colour per line', async () => {
  const writeText = mockClipboard();
  const view = render(<Palette palette={gtaV} />);
  await act(async () => fireEvent.click(view.getByRole('button', { name: /copy all/i })));
  expect(writeText).toHaveBeenCalledWith(paletteText(gtaV));
  expect(paletteText(gtaV).split('\n')[0]).toBe('Land #404640');
});

it.each([gtaViDay, gtaViNight, gtaV])('$name has valid, unique hex colours', (palette) => {
  const all = [...palette.colours.map((c) => c.hex), ...palette.sea.map((s) => s.hex)];
  for (const hex of all) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  expect(new Set(palette.colours.map((c) => c.name)).size).toBe(palette.colours.length);
});
