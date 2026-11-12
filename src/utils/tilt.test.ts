import { expect, it } from 'vitest';
import { MAX_TILT_DEG, tiltFor } from './tilt';

it('caps tilt at six degrees', () => expect(MAX_TILT_DEG).toBe(6));
it('is flat at the centre', () => expect(tiltFor(0.5, 0.5)).toEqual({ rx: 0, ry: 0 }));
it('reaches the maximum at the corners', () => expect(tiltFor(1, 0)).toEqual({ rx: 6, ry: 6 }));
it('leans the other way at the opposite corner', () => expect(tiltFor(0, 1)).toEqual({ rx: -6, ry: -6 }));
it('clamps positions outside the element', () => expect(tiltFor(5, -3)).toEqual(tiltFor(1, 0)));
it('takes a smaller maximum', () => expect(tiltFor(1, 0, 3)).toEqual({ rx: 3, ry: 3 }));
