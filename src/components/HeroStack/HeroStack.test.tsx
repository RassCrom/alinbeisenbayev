import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Project } from '../../types';
import HeroStack from './HeroStack';

const five = ['a', 'b', 'c', 'd', 'e'].map(
  (slug) => ({ id: slug, slug, title: `Work ${slug}`, coverImage: `/images/${slug}.webp` }) as unknown as Project,
);

it('shows at most three covers', () => {
  expect(render(<HeroStack works={five} />).container.querySelectorAll('img')).toHaveLength(3);
});

it('loads only the front cover eagerly', () => {
  const imgs = [...render(<HeroStack works={five} />).container.querySelectorAll('img')];
  expect(imgs.filter((img) => img.getAttribute('loading') === 'eager').map((img) => img.getAttribute('src'))).toEqual([
    '/images/a.webp',
  ]);
});

it('renders one work without failing', () => {
  expect(render(<HeroStack works={five.slice(0, 1)} />).container.querySelectorAll('img')).toHaveLength(1);
});

it('renders nothing with no works', () => {
  expect(render(<HeroStack works={[]} />).container.firstChild).toBeNull();
});

it('is decoration: hidden from assistive tech', () => {
  expect(render(<HeroStack works={five} />).container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
});
