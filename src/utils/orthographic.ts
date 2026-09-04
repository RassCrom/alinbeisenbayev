/**
 * Orthographic projection — the view of a globe from infinitely far away, and
 * the projection every hand-drawn "globe seen from space" has used since
 * Ptolemy. About 30 lines of trigonometry, which is why this file exists
 * instead of a 3D engine.
 *
 * Shared by the About-page globe and the per-project locator insets.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  /** False when the point is on the far side of the sphere. */
  visible: boolean;
}

export interface Viewport {
  /** Centre of the disc, in canvas pixels. */
  cx: number;
  cy: number;
  /** Radius of the disc, in canvas pixels. */
  radius: number;
}

const DEG = Math.PI / 180;

/**
 * Projects a coordinate onto the disc, with `centre` as the point facing the
 * viewer. `visible` is the standard orthographic test: cos(c) is the cosine of
 * the angular distance from the centre of projection, so it goes negative for
 * everything on the hemisphere turned away from us.
 */
export function project(
  point: LatLng,
  centre: LatLng,
  viewport: Viewport,
): ProjectedPoint {
  const phi = point.lat * DEG;
  const lambda = point.lng * DEG;
  const phi0 = centre.lat * DEG;
  const lambda0 = centre.lng * DEG;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);
  const deltaLambda = lambda - lambda0;
  const cosDelta = Math.cos(deltaLambda);

  const cosC = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDelta;

  const x = cosPhi * Math.sin(deltaLambda);
  const y = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDelta;

  return {
    // Canvas y grows downward; the projection's y grows north, hence the minus.
    x: viewport.cx + viewport.radius * x,
    y: viewport.cy - viewport.radius * y,
    visible: cosC >= 0,
  };
}

/** Unit vector on the sphere, for interpolation that stays on the surface. */
function toVector({ lat, lng }: LatLng): [number, number, number] {
  const phi = lat * DEG;
  const lambda = lng * DEG;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

function toLatLng([x, y, z]: [number, number, number]): LatLng {
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, z))) / DEG,
    lng: Math.atan2(y, x) / DEG,
  };
}

/**
 * Spherical interpolation between two coordinates.
 *
 * Used for two things: the great-circle arcs between story points (the actual
 * shortest path over the Earth, not a straight line in screen space), and
 * easing the globe's centre from one place to the next — which is the same
 * problem, so it is the same function. Interpolating lat and lng separately
 * would drift off the great circle and swing wildly near the poles.
 */
export function interpolate(from: LatLng, to: LatLng, t: number): LatLng {
  const a = toVector(from);
  const b = toVector(to);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);

  // Coincident (or antipodal) points: slerp is undefined, so fall back to lerp.
  if (omega < 1e-6) return to;

  const sinOmega = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinOmega;
  const wb = Math.sin(t * omega) / sinOmega;
  return toLatLng([
    a[0] * wa + b[0] * wb,
    a[1] * wa + b[1] * wb,
    a[2] * wa + b[2] * wb,
  ]);
}

/** Samples a great circle between two coordinates, for drawing. */
export function greatCircle(from: LatLng, to: LatLng, segments = 48): LatLng[] {
  const path: LatLng[] = [];
  for (let i = 0; i <= segments; i += 1) {
    path.push(interpolate(from, to, i / segments));
  }
  return path;
}

/** Meridians and parallels, as coordinate paths ready to project. */
export function graticule(step = 30, resolution = 6): LatLng[][] {
  const lines: LatLng[][] = [];

  for (let lng = -180; lng < 180; lng += step) {
    const meridian: LatLng[] = [];
    for (let lat = -90; lat <= 90; lat += resolution) meridian.push({ lat, lng });
    lines.push(meridian);
  }

  // Skip the poles themselves — a parallel there is a point, not a circle.
  for (let lat = -90 + step; lat < 90; lat += step) {
    const parallel: LatLng[] = [];
    for (let lng = -180; lng <= 180; lng += resolution) parallel.push({ lat, lng });
    lines.push(parallel);
  }

  return lines;
}

/** Cubic ease-in-out, for camera moves. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Traces a path of coordinates onto the context, lifting the pen wherever the
 * path crosses to the far side of the sphere. Without the lift, a coastline
 * that wraps around the limb draws a chord straight across the disc.
 */
export function tracePath(
  ctx: CanvasRenderingContext2D,
  path: LatLng[],
  centre: LatLng,
  viewport: Viewport,
): void {
  let drawing = false;
  for (const coordinate of path) {
    const { x, y, visible } = project(coordinate, centre, viewport);
    if (!visible) {
      drawing = false;
      continue;
    }
    if (drawing) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      drawing = true;
    }
  }
}
