import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import FieldCamp from './FieldCamp';

const svg = () => render(<FieldCamp />).container.querySelector('svg')!;

it('is decoration: hidden from assistive tech, with no text of its own', () => {
  const art = svg();
  expect(art.getAttribute('aria-hidden')).toBe('true');
  expect(art.getAttribute('focusable')).toBe('false');
  expect(art.querySelector('text, title')).toBeNull();
});

it('is drawn in one stroke weight, the icons’ own', () => {
  const art = svg();
  expect(art.getAttribute('stroke-width')).toBe('1.6');
  expect(art.getAttribute('stroke-linecap')).toBe('round');
  expect(art.getAttribute('stroke-linejoin')).toBe('round');
  expect(art.getAttribute('fill')).toBe('none');
  expect(art.querySelectorAll('[stroke-width]')).toHaveLength(0);
});

it('carries no colour of its own: the stylesheet themes it', () => {
  const art = svg();
  expect(art.getAttribute('stroke')).toBe('currentColor');
  expect(art.outerHTML).not.toMatch(/#[0-9a-f]{3,6}/i);
});

it('has four depths, far to near', () => {
  const layers = [...svg().children].map((child) => child.getAttribute('class'));
  expect(layers).toEqual(['field-camp__sky', 'field-camp__mountains', 'field-camp__mid', 'field-camp__near']);
});

it('keeps the accent for what burns or waves: lantern, fire, flags', () => {
  const accents = [...svg().querySelectorAll('.field-camp__accent')];
  expect(accents.length).toBeGreaterThan(0);
  for (const accent of accents) {
    expect(accent.closest('.field-camp__lantern, .field-camp__fire, .field-camp__flags')).not.toBeNull();
  }
});

it('has its moving parts as separate elements', () => {
  const art = svg();
  const count = (name: string) => art.querySelectorAll(`.field-camp__${name}`).length;
  expect(count('star')).toBe(3);
  expect(count('cloud')).toBe(3);
  expect(count('bird')).toBe(3);
  expect(count('flame')).toBe(2);
  expect(count('flag')).toBe(2);
  expect(count('steam')).toBe(2);
  expect(count('shooting-star')).toBe(1);
  expect(count('lantern')).toBe(1);
});
