import { fireEvent, render } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { setMedia } from '../test/setup';
import { useTilt } from './useTilt';

function Probe() {
  const tilt = useTilt<HTMLDivElement>();
  return <div data-testid="el" ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} />;
}

let el: HTMLElement;
beforeEach(() => {
  el = render(<Probe />).getByTestId('el');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
});

const move = (pointerType: string) => fireEvent.pointerMove(el, { clientX: 200, clientY: 0, pointerType });

it('tilts under a mouse on a fine pointer, and settles on leave', () => {
  setMedia(['(pointer: fine)']);
  move('mouse');
  expect(el.style.getPropertyValue('--ry')).toBe('6deg');
  expect(el.style.getPropertyValue('--rx')).toBe('6deg');
  fireEvent.pointerLeave(el);
  expect(el.style.getPropertyValue('--ry')).toBe('');
  expect(el.style.getPropertyValue('--rx')).toBe('');
});

it('never tilts on touch, so a tap cannot leave a card stuck', () => {
  setMedia(['(pointer: fine)']);
  move('touch');
  expect(el.style.getPropertyValue('--ry')).toBe('');
});

it('never tilts on a coarse pointer', () => {
  setMedia([]);
  move('mouse');
  expect(el.style.getPropertyValue('--ry')).toBe('');
});

it('never tilts with reduced motion', () => {
  setMedia(['(pointer: fine)', '(prefers-reduced-motion: reduce)']);
  move('mouse');
  expect(el.style.getPropertyValue('--ry')).toBe('');
});
