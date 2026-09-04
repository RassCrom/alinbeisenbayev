import { useEffect, useRef } from 'react';
import type { GeoContext, GeoOrigin } from '../../types';
import { LAND_RINGS } from '../../utils/land';
import {
  type LatLng,
  type Viewport,
  graticule,
  greatCircle,
  project,
  tracePath,
} from '../../utils/orthographic';

export interface LocatorInsetProps {
  /** The places the project is *about*. */
  contexts: GeoContext[];
  /** Where the project was made. Drawn only if it is on the visible hemisphere. */
  origin?: GeoOrigin | null;
  /** Rendered size in CSS pixels. */
  size?: number;
}

const GRATICULE = graticule(30, 6);

/** A context is either a point or a polygon carrying its centroid. */
function contextCoordinate(context: GeoContext): LatLng | null {
  if (context.connectionType === 'polygon') {
    return context.centroidLat !== undefined && context.centroidLng !== undefined
      ? { lat: context.centroidLat, lng: context.centroidLng }
      : null;
  }
  return context.lat !== undefined && context.lng !== undefined
    ? { lat: context.lat, lng: context.lng }
    : null;
}

/**
 * Mean direction of a set of coordinates.
 *
 * Averaging longitudes arithmetically breaks across the antimeridian — two
 * projects either side of it would average to somewhere near 0°E, the wrong
 * side of the planet. Averaging the unit vectors instead gives the true
 * centre of the group.
 */
function centroid(points: LatLng[]): LatLng {
  const DEG = Math.PI / 180;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const { lat, lng } of points) {
    const phi = lat * DEG;
    const lambda = lng * DEG;
    const cosPhi = Math.cos(phi);
    x += cosPhi * Math.cos(lambda);
    y += cosPhi * Math.sin(lambda);
    z += Math.sin(phi);
  }
  const length = Math.hypot(x, y, z);
  if (length < 1e-9) return points[0] ?? { lat: 0, lng: 0 };
  return {
    lat: Math.asin(z / length) / DEG,
    lng: Math.atan2(y, x) / DEG,
  };
}

/**
 * A locator inset: the small globe in the margin of a map that says where on
 * Earth the sheet you're looking at actually is. Same orthographic projection
 * and same coastlines as the About-page globe, drawn once rather than animated.
 */
export default function LocatorInset({ contexts, origin, size = 132 }: LocatorInsetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const targets = contexts
    .map(contextCoordinate)
    .filter((coordinate): coordinate is LatLng => coordinate !== null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || targets.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const style = getComputedStyle(canvas);
      const rgba = (name: string, alpha: number, fallback: string) => {
        const triplet = style.getPropertyValue(name).trim();
        return triplet ? `rgba(${triplet}, ${alpha})` : fallback;
      };
      const token = (name: string, fallback: string) =>
        style.getPropertyValue(name).trim() || fallback;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const view: Viewport = { cx: size / 2, cy: size / 2, radius: size / 2 - 3 };
      const centre = centroid(targets);

      // Ocean disc
      ctx.beginPath();
      ctx.arc(view.cx, view.cy, view.radius, 0, Math.PI * 2);
      ctx.fillStyle = rgba('--color-surface-rgb', 0.6, 'rgba(18, 26, 45, 0.6)');
      ctx.fill();

      // Graticule
      ctx.beginPath();
      for (const line of GRATICULE) tracePath(ctx, line, centre, view);
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = rgba('--color-accent-rgb', 0.18, 'rgba(68, 114, 168, 0.18)');
      ctx.stroke();

      // Coastlines — outlines only, for the same limb-clipping reason as the globe
      ctx.beginPath();
      for (const ring of LAND_RINGS) tracePath(ctx, ring, centre, view);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = rgba('--color-accent-light-rgb', 0.6, 'rgba(102, 145, 192, 0.6)');
      ctx.stroke();

      // Limb
      ctx.beginPath();
      ctx.arc(view.cx, view.cy, view.radius, 0, Math.PI * 2);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = rgba('--color-accent-rgb', 0.4, 'rgba(68, 114, 168, 0.4)');
      ctx.stroke();

      // Where it was made -> what it maps, if both are on this side
      const originPoint = origin ? { lat: origin.lat, lng: origin.lng } : null;
      if (originPoint) {
        ctx.beginPath();
        for (const target of targets) {
          tracePath(ctx, greatCircle(originPoint, target, 32), centre, view);
        }
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = rgba('--color-accent-light-rgb', 0.45, 'rgba(102, 145, 192, 0.45)');
        ctx.stroke();
        ctx.setLineDash([]);

        const projected = project(originPoint, centre, view);
        if (projected.visible) {
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = token('--color-accent-light', '#6691c0');
          ctx.fill();
        }
      }

      // Subject markers, in the gold reserved for the thing being highlighted
      for (const target of targets) {
        const projected = project(target, centre, view);
        if (!projected.visible) continue;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = token('--color-accent-gold', '#9e7f4a');
        ctx.fill();
      }
    };

    draw();

    // Redraw on theme change so the inset follows the tokens like everything else.
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
    // `targets` is derived from props each render; depend on its content.
  }, [JSON.stringify(targets), origin?.lat, origin?.lng, size]);

  if (targets.length === 0) return null;

  const subjects = contexts.map((context) => context.label).filter(Boolean);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="block shrink-0"
      role="img"
      aria-label={
        subjects.length > 0
          ? `Locator globe showing ${subjects.join(', ')}`
          : 'Locator globe'
      }
    />
  );
}
