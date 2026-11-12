import { expect, it } from 'vitest';
import { contrast } from './contrast';

it('matches known WCAG ratios', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
  expect(contrast('#f3ebdf', '#14110f')).toBeCloseTo(15.9, 1);
  expect(contrast('#14110f', '#f3ebdf')).toBeCloseTo(15.9, 1);
});
