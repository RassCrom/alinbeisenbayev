import { describe, expect, it } from 'vitest';
import { invert, project } from './ortelius';

const HALF_PI = Math.PI / 2;

describe('Ortelius oval', () => {
  it('spaces the equator and the central meridian evenly', () => {
    expect(project(90, 0).x).toBeCloseTo(HALF_PI);
    expect(project(-180, 0).x).toBeCloseTo(-Math.PI);
    expect(project(0, 45).y).toBeCloseTo(Math.PI / 4);
    expect(project(0, 45).x).toBeCloseTo(0);
  });

  it('draws the 90th meridian as a half circle and closes the oval with round ends', () => {
    const p = project(90, 60);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(HALF_PI);
    const end = project(180, 60);
    expect(Math.hypot(end.x - HALF_PI, end.y)).toBeCloseTo(HALF_PI);
  });

  it('meets every central meridian at one pole point, and flattens the pole beyond 90°', () => {
    expect(project(45, 90).x).toBeCloseTo(0);
    expect(project(180, 90).x).toBeCloseTo(HALF_PI);
  });

  it('inverts what it projects', () => {
    for (const [lng, lat] of [
      [0, 0],
      [76.9, 43.2],
      [-0.12, 51.5],
      [-122.4, 37.8],
      [151.2, -33.9],
      [-179, -80],
      [10, 88],
      [0.0001, 30],
    ]) {
      const p = project(lng, lat);
      const back = invert(p.x, p.y);
      expect(back).not.toBeNull();
      expect(back!.lng).toBeCloseTo(lng, 6);
      expect(back!.lat).toBeCloseTo(lat, 6);
    }
  });

  it('returns null outside the oval', () => {
    expect(invert(Math.PI + 0.2, 0)).toBeNull();
    expect(invert(0, 2)).toBeNull();
    expect(invert(3, 1.4)).toBeNull();
  });
});
