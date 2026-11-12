import { expect, it } from 'vitest';
import type { Project } from '../types';
import { featuredWorks } from './featured';

const work = (slug: string, featured: boolean, featuredOrder?: number) =>
  ({ slug, featured, featuredOrder }) as unknown as Project;

it('orders by featuredOrder and drops the rest', () => {
  const list = [work('c', true, 3), work('x', false), work('a', true, 1), work('z', true)];
  expect(featuredWorks(list).map((p) => p.slug)).toEqual(['a', 'c', 'z']);
});

it('returns nothing when nothing is featured', () => {
  expect(featuredWorks([work('x', false)])).toEqual([]);
});

it('does not reorder the list it was given', () => {
  const list = [work('b', true, 2), work('a', true, 1)];
  featuredWorks(list);
  expect(list.map((p) => p.slug)).toEqual(['b', 'a']);
});
