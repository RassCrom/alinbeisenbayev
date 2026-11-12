import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { setMedia } from '../../test/setup';
import type { GalleryItem } from '../../types';
import PieceCard from './PieceCard';

const video = {
  id: 'beni-meander',
  title: 'Beni River meanders',
  kind: 'video',
  date: '2026-09-17',
  width: 1080,
  height: 1350,
  src: '/gallery/beni.mp4',
  poster: '/gallery/beni-poster.webp',
  preview: '/gallery/beni-loop.mp4',
  offers: ['remote-sensing'],
} as GalleryItem;

const image = {
  id: 'duck-river',
  title: 'Duck River',
  kind: 'image',
  date: '2024-08-10',
  width: 2000,
  height: 1400,
  src: '/gallery/duck.webp',
  variants: [480, 960],
  offers: ['custom-maps'],
} as GalleryItem;

it('is a button that opens the piece', () => {
  const onOpen = vi.fn();
  const { getByRole } = render(<PieceCard item={image} onOpen={onOpen} />);
  fireEvent.click(getByRole('button'));
  expect(onOpen).toHaveBeenCalledWith(image);
});

it('shows the title and the first offer', () => {
  const { getByText } = render(<PieceCard item={video} onOpen={() => {}} />);
  expect(getByText('Beni River meanders')).not.toBeNull();
  expect(getByText('Remote sensing')).not.toBeNull();
});

it('shows a video by its poster, marked with a play icon', () => {
  const { container } = render(<PieceCard item={video} onOpen={() => {}} />);
  expect(container.querySelector('img')!.getAttribute('src')).toBe('/gallery/beni-poster.webp');
  expect(container.querySelector('.piece-card__play')).not.toBeNull();
  expect(container.querySelector('video')).toBeNull();
});

it('shows an image at its own sizes, with no play icon', () => {
  const { container } = render(<PieceCard item={image} onOpen={() => {}} />);
  expect(container.querySelector('img')!.getAttribute('srcset')).toContain('/gallery/duck-w480.webp 480w');
  expect(container.querySelector('.piece-card__play')).toBeNull();
});

const hover = (pointerType: string) => {
  const view = render(<PieceCard item={video} onOpen={() => {}} />);
  fireEvent.pointerEnter(view.getByRole('button'), { pointerType });
  return view.container.querySelector('video');
};

it('plays the short preview under a mouse', () => {
  setMedia(['(pointer: fine)']);
  expect(hover('mouse')!.getAttribute('src')).toBe('/gallery/beni-loop.mp4');
});

it('attaches no video on touch', () => {
  setMedia(['(pointer: fine)']);
  expect(hover('touch')).toBeNull();
});

it('attaches no video with reduced motion', () => {
  setMedia(['(pointer: fine)', '(prefers-reduced-motion: reduce)']);
  expect(hover('mouse')).toBeNull();
});

it('attaches no video with data saver on', () => {
  setMedia(['(pointer: fine)']);
  Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
  try {
    expect(hover('mouse')).toBeNull();
  } finally {
    Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
  }
});

it('stops the preview when the pointer leaves', () => {
  setMedia(['(pointer: fine)']);
  const { getByRole, container } = render(<PieceCard item={video} onOpen={() => {}} />);
  fireEvent.pointerEnter(getByRole('button'), { pointerType: 'mouse' });
  expect(container.querySelector('video')).not.toBeNull();
  fireEvent.pointerLeave(getByRole('button'));
  expect(container.querySelector('video')).toBeNull();
});
