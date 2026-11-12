import { fireEvent, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import Frame from './Frame';

it('reserves the image ratio before load', () => {
  const { container } = render(<Frame src="/a.webp" alt="A" width={1200} height={800} />);
  const img = container.querySelector('img')!;
  expect(img.getAttribute('width')).toBe('1200');
  expect(img.getAttribute('height')).toBe('800');
  expect((img.parentElement as HTMLElement).style.aspectRatio).toBe('1200 / 800');
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
});

it('uses an explicit ratio when given one', () => {
  const { container } = render(<Frame src="/a.webp" alt="A" width={1200} height={800} ratio="16 / 9" />);
  expect((container.querySelector('img')!.parentElement as HTMLElement).style.aspectRatio).toBe('16 / 9');
});

it('is lazy unless priority', () => {
  const lazy = render(<Frame src="/a.webp" alt="" width={1} height={1} />);
  expect(lazy.container.querySelector('img')!.getAttribute('loading')).toBe('lazy');
  const eager = render(<Frame src="/b.webp" alt="" width={1} height={1} priority />);
  expect(eager.container.querySelector('img')!.getAttribute('loading')).toBe('eager');
});

it('marks the image loaded so it can fade in', () => {
  const { container } = render(<Frame src="/a.webp" alt="A" width={4} height={3} />);
  const img = container.querySelector('img')!;
  expect(img.dataset.loaded).toBe('false');
  fireEvent.load(img);
  expect(img.dataset.loaded).toBe('true');
});
