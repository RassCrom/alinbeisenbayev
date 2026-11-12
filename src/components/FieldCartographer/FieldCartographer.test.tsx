import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import Footer from '../Footer/Footer';
import FieldCartographer from './FieldCartographer';

it('is decoration: hidden from assistive tech, with no text of its own', () => {
  const svg = render(<FieldCartographer />).container.querySelector('svg')!;
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(svg.getAttribute('focusable')).toBe('false');
  expect(svg.querySelector('text, title')).toBeNull();
});

it('is drawn in the same stroke as the icons', () => {
  const svg = render(<FieldCartographer />).container.querySelector('svg')!;
  expect(svg.getAttribute('stroke-width')).toBe('1.6');
  expect(svg.getAttribute('stroke-linecap')).toBe('round');
  expect(svg.getAttribute('stroke-linejoin')).toBe('round');
  expect(svg.getAttribute('fill')).toBe('none');
  // No element overrides the stroke width: one weight throughout.
  expect(svg.querySelectorAll('[stroke-width]')).toHaveLength(0);
});

it('has three depths', () => {
  const svg = render(<FieldCartographer />).container.querySelector('svg')!;
  for (const layer of ['far', 'mid', 'near']) {
    expect(svg.querySelector(`g.field-cartographer__${layer}`), layer).not.toBeNull();
  }
});

it('spends the accent on exactly one detail', () => {
  const svg = render(<FieldCartographer />).container.querySelector('svg')!;
  expect(svg.querySelectorAll('.field-cartographer__accent')).toHaveLength(1);
});

it('stands above the footer links', () => {
  const { container } = render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
  const art = container.querySelector('svg.field-cartographer')!;
  const links = container.querySelector('.footer__inner')!;
  expect(art).not.toBeNull();
  expect(art.compareDocumentPosition(links) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
