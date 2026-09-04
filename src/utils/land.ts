import landData from '../data/land-110m.json';
import type { LatLng } from './orthographic';

interface LandPayload {
  /** Coordinates are stored as round(degrees * scale). */
  scale: number;
  /** Flat [lon, lat, lon, lat, …] per ring. */
  rings: number[][];
}

const { scale, rings } = landData as LandPayload;

/**
 * Natural Earth 110m coastlines, decoded once from the packed integer rings in
 * land-110m.json (see scripts/build-land-data.mjs, which generates it).
 *
 * Kept as plain coordinate arrays so both the globe and the locator insets can
 * project them through the same code; at 110m this is ~2k points, small enough
 * that re-projecting every frame is cheaper than caching per-rotation.
 */
export const LAND_RINGS: LatLng[][] = rings.map((flat) => {
  const ring: LatLng[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    ring.push({ lng: flat[i] / scale, lat: flat[i + 1] / scale });
  }
  // Close the ring so the coastline meets itself.
  if (ring.length > 0) ring.push(ring[0]);
  return ring;
});
