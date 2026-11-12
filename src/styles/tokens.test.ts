import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { contrast } from '../utils/contrast';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const hex = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const px = (name: string) => Number(css.match(new RegExp(`--${name}:\\s*(\\d+)px`))![1]);

it('pins the Lamp palette', () => {
  expect(hex('bg')).toBe('#14110f');
  expect(hex('accent')).toBe('#f0823c');
  expect(hex('accent-ink')).toBe('#1d0f06');
});

it.each(['text', 'text-2', 'text-3', 'accent'])('%s clears 4.5:1 on every background', (token) => {
  for (const background of ['bg', 'surface', 'raised']) {
    expect(contrast(hex(token), hex(background))).toBeGreaterThanOrEqual(4.5);
  }
});

it('accent-ink clears 4.5:1 on accent', () => {
  expect(contrast(hex('accent-ink'), hex('accent'))).toBeGreaterThanOrEqual(4.5);
});

it('inner radius is outer minus padding', () => {
  expect(px('r-outer') - px('frame-pad')).toBe(px('r-inner'));
  expect(px('r-outer-sm') - px('frame-pad-sm')).toBe(px('r-inner-sm'));
});

it('has one theme, so a stored theme=light changes nothing', () => {
  expect(css).not.toMatch(/data-theme/);
  expect(readFileSync('index.html', 'utf8')).not.toMatch(/localStorage/);
});
