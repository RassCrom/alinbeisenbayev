/**
 * Turns Natural Earth's 110m land polygons into the compact ring list the
 * About-page globe draws.
 *
 *   curl -sSL -o /tmp/ne_110m_land.geojson \
 *     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
 *   node scripts/build-land-data.mjs /tmp/ne_110m_land.geojson
 *
 * Source: Natural Earth (naturalearthdata.com), public domain, via
 * github.com/nvkelso/natural-earth-vector. 110m is the coarsest of the three
 * Natural Earth scales, which is the right one here — the globe is at most a
 * few hundred pixels across, so anything finer is detail nobody can see.
 *
 * Output is not GeoJSON. Each ring becomes a flat array of integers in
 * tenths of a degree — [lon, lat, lon, lat, …] — which drops the per-point
 * brackets, the key names and ~5 decimal places of precision that a globe this
 * size cannot resolve. 0.1° is about a third of a pixel at 600px wide.
 */
import fs from 'node:fs';

const INPUT = process.argv[2];
const OUTPUT = 'src/data/land-110m.json';

/** Degrees. Points closer than this to the line between their neighbours go. */
const SIMPLIFY_TOLERANCE = 0.35;
/** Degrees squared. Rings with a smaller bounding box are dropped as invisible. */
const MIN_RING_EXTENT = 1.2;
/** Coordinates are stored as round(value * SCALE). */
const SCALE = 10;

if (!INPUT) {
  console.error('usage: node scripts/build-land-data.mjs <ne_110m_land.geojson>');
  process.exit(1);
}

/** Perpendicular distance from p to the line ab, in degrees. */
function pointLineDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + clamped * dx), p[1] - (a[1] + clamped * dy));
}

/** Ramer–Douglas–Peucker. Iterative, so a long coastline can't blow the stack. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const distance = pointLineDistance(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const geo = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

const rings = [];
let inputPoints = 0;

for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === 'Polygon' ? [coordinates] : coordinates;
  for (const polygon of polygons) {
    // Ring 0 is the outer boundary; the rest are holes (lakes), which read as
    // noise at this size.
    const ring = polygon[0];
    inputPoints += ring.length;

    const lons = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    const extent = Math.max(
      Math.max(...lons) - Math.min(...lons),
      Math.max(...lats) - Math.min(...lats),
    );
    if (extent < MIN_RING_EXTENT) continue;

    const simplified = simplify(ring, SIMPLIFY_TOLERANCE);
    if (simplified.length < 4) continue;

    const flat = [];
    let previousLon = null;
    let previousLat = null;
    for (const [lon, lat] of simplified) {
      const qLon = Math.round(lon * SCALE);
      const qLat = Math.round(lat * SCALE);
      // Quantising can collapse neighbours onto the same point.
      if (qLon === previousLon && qLat === previousLat) continue;
      flat.push(qLon, qLat);
      previousLon = qLon;
      previousLat = qLat;
    }
    if (flat.length >= 8) rings.push(flat);
  }
}

const payload = { scale: SCALE, rings };
fs.writeFileSync(OUTPUT, JSON.stringify(payload));

const outputPoints = rings.reduce((sum, r) => sum + r.length / 2, 0);
console.log(
  `${OUTPUT}\n` +
    `  rings   ${geo.features.length} features -> ${rings.length} rings\n` +
    `  points  ${inputPoints} -> ${outputPoints} (${Math.round((1 - outputPoints / inputPoints) * 100)}% fewer)\n` +
    `  size    ${(fs.statSync(INPUT).size / 1024).toFixed(0)} KB -> ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`,
);
