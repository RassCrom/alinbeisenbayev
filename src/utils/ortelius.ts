/**
 * Ortelius oval projection: the projection of Abraham Ortelius' world map of
 * 1570, the first printed world map of the modern era, and the one most
 * people picture when they hear "old map". Neither Mercator nor a globe.
 *
 * Latitude is spaced evenly. Inside 90° of the central meridian each meridian
 * is a circular arc through both poles; beyond that the meridians are the same
 * arc shifted outward, so the world closes as an oval with flat poles and
 * round ends.
 *
 * Units are radians: x runs from -π to π and y from -π/2 to π/2, y up.
 */

const DEG = Math.PI / 180;
const HALF_PI = Math.PI / 2;

export interface XY {
  x: number;
  y: number;
}

export function project(lng: number, lat: number): XY {
  const lam = lng * DEG;
  const phi = Math.max(-HALF_PI, Math.min(HALF_PI, lat * DEG));
  const a = Math.abs(lam);
  let x: number;
  if (a >= HALF_PI) {
    x = Math.sqrt(Math.max(0, HALF_PI * HALF_PI - phi * phi)) + a - HALF_PI;
  } else if (a === 0) {
    x = 0;
  } else {
    // Radius of the meridian arc. Written as a - y²/(F + √(F² - y²)) instead of
    // a - F + √(F² - y²) so it stays exact near the central meridian, where F is huge.
    const f = (Math.PI * Math.PI) / (8 * a) + a / 2;
    x = a - (phi * phi) / (f + Math.sqrt(f * f - phi * phi));
  }
  return { x: lam < 0 ? -x : x, y: phi };
}

/** Inverse of `project`, in degrees. Null for a point outside the oval. */
export function invert(x: number, y: number): { lng: number; lat: number } | null {
  if (Math.abs(y) > HALF_PI + 1e-9) return null;
  const phi = Math.max(-HALF_PI, Math.min(HALF_PI, y));
  const a = Math.abs(x);
  const edge = Math.sqrt(Math.max(0, HALF_PI * HALF_PI - phi * phi));
  let lam: number;
  if (a >= edge) {
    lam = a - edge + HALF_PI;
    if (lam > Math.PI + 1e-9) return null;
  } else if (a < 1e-12) {
    lam = 0;
  } else {
    // The meridian through (a, y) is the circle through both poles; its centre
    // sits on the equator at c, and it crosses the equator at λ = c + radius.
    const c = (a * a + phi * phi - HALF_PI * HALF_PI) / (2 * a);
    lam = c + Math.sqrt(c * c + HALF_PI * HALF_PI);
  }
  lam = Math.min(lam, Math.PI);
  return { lng: ((x < 0 ? -lam : lam) / DEG), lat: phi / DEG };
}

/** Outline of the oval, counter-clockwise from the east end of the equator. */
export function outline(step = 2): XY[] {
  const pts: XY[] = [];
  for (let lat = -90; lat <= 90; lat += step) pts.push(project(180, lat));
  for (let lat = 90; lat >= -90; lat -= step) pts.push(project(-180, lat));
  return pts;
}
