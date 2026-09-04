import { useCallback, useEffect, useRef } from 'react';
import type { StoryPoint } from '../../types';
import { LAND_RINGS } from '../../utils/land';
import {
  type LatLng,
  type Viewport,
  easeInOut,
  graticule,
  greatCircle,
  interpolate,
  project,
  tracePath,
} from '../../utils/orthographic';

export interface GlobeStoryProps {
  points: StoryPoint[];
  activeStoryIndex: number;
  /** Intro mode: slow spin before the scroll story takes over. */
  autoRotate?: boolean;
  /** Called with the story index when a point on the globe is clicked. */
  onPointClick?: (index: number) => void;
}

const GRATICULE = graticule(30);
/** Camera move between two story points. */
const FLIGHT_MS = 1400;
/** Degrees of longitude per second during the intro spin. */
const SPIN_DEG_PER_SEC = 6;
/** Hit radius for clicking a marker, in CSS pixels. */
const HIT_RADIUS = 14;

interface Palette {
  ocean: string;
  graticule: string;
  coast: string;
  arc: string;
  point: string;
  active: string;
  limb: string;
}

/**
 * The globe is drawn, not textured, so it can take its colours from the same
 * tokens as everything else — which the WebGL version could not, and why it
 * stayed dark blue in the light theme.
 */
function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const rgba = (name: string, alpha: number, fallback: string) => {
    const triplet = style.getPropertyValue(name).trim();
    return triplet ? `rgba(${triplet}, ${alpha})` : fallback;
  };

  return {
    ocean: rgba('--color-surface-rgb', 0.55, 'rgba(18, 26, 45, 0.55)'),
    graticule: rgba('--color-accent-rgb', 0.16, 'rgba(68, 114, 168, 0.16)'),
    coast: rgba('--color-accent-light-rgb', 0.72, 'rgba(102, 145, 192, 0.72)'),
    arc: rgba('--color-accent-light-rgb', 0.5, 'rgba(102, 145, 192, 0.5)'),
    point: token('--color-accent-light', '#6691c0'),
    active: token('--color-accent-gold', '#9e7f4a'),
    limb: rgba('--color-accent-rgb', 0.35, 'rgba(68, 114, 168, 0.35)'),
  };
}

export default function GlobeStory({
  points,
  activeStoryIndex,
  autoRotate = false,
  onPointClick,
}: GlobeStoryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Where the globe is looking now, and where it is heading. */
  const centre = useRef<LatLng>({ lat: points[0]?.location.lat ?? 0, lng: points[0]?.location.lng ?? 0 });
  const flight = useRef<{ from: LatLng; to: LatLng; start: number } | null>(null);
  const spinFrom = useRef<number>(0);
  const viewport = useRef<Viewport>({ cx: 0, cy: 0, radius: 0 });
  const palette = useRef<Palette | null>(null);
  const markerPositions = useRef<{ x: number; y: number; index: number }[]>([]);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const arcs = useRef(
    points.slice(0, -1).map((point, index) =>
      greatCircle(point.location, points[index + 1].location, 40),
    ),
  );

  /* ---- Camera: retarget whenever the active panel changes ---- */
  useEffect(() => {
    const target = points[activeStoryIndex]?.location;
    if (!target || autoRotate) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      centre.current = { ...target };
      flight.current = null;
      return;
    }
    flight.current = { from: { ...centre.current }, to: { ...target }, start: performance.now() };
  }, [activeStoryIndex, points, autoRotate]);

  useEffect(() => {
    if (autoRotate) spinFrom.current = performance.now();
  }, [autoRotate]);

  /* ---- Sizing, palette, and the draw loop ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    palette.current = readPalette(container);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = container.clientWidth;
      const height = container.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewport.current = {
        cx: width / 2,
        cy: height / 2,
        // Leave a margin so the limb never touches the edge of the column.
        radius: Math.max(0, Math.min(width, height) / 2 - 12),
      };
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // The theme toggle swaps tokens on <html>; re-read rather than re-mount.
    const themeObserver = new MutationObserver(() => {
      palette.current = readPalette(container);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    let frame = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const view = viewport.current;
      const colours = palette.current;
      if (!ctx || !colours || view.radius <= 0) return;

      /* Advance the camera */
      if (autoRotateRef.current) {
        const elapsed = (now - spinFrom.current) / 1000;
        centre.current = {
          lat: centre.current.lat,
          lng: ((centre.current.lng + elapsed * SPIN_DEG_PER_SEC + 180) % 360) - 180,
        };
        spinFrom.current = now;
      } else if (flight.current) {
        const t = Math.min(1, (now - flight.current.start) / FLIGHT_MS);
        centre.current = interpolate(flight.current.from, flight.current.to, easeInOut(t));
        if (t >= 1) flight.current = null;
      }

      const c = centre.current;
      ctx.clearRect(0, 0, view.cx * 2, view.cy * 2);

      /* Ocean disc */
      ctx.beginPath();
      ctx.arc(view.cx, view.cy, view.radius, 0, Math.PI * 2);
      ctx.fillStyle = colours.ocean;
      ctx.fill();

      /* Graticule */
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = colours.graticule;
      ctx.beginPath();
      for (const line of GRATICULE) tracePath(ctx, line, c, view);
      ctx.stroke();

      /*
       * Coastlines as linework, deliberately unfilled.
       *
       * Filling would need the rings clipped against the limb — walking along
       * the edge of the disc from where a coastline leaves the visible
       * hemisphere to where it returns. Without that, canvas closes each
       * clipped run with a straight chord and Africa bleeds a hard-edged wedge
       * across the ocean. Outlines have no such problem, and an engraved globe
       * is the more honest reference anyway.
       */
      ctx.beginPath();
      for (const ring of LAND_RINGS) tracePath(ctx, ring, c, view);
      ctx.lineWidth = 1;
      ctx.strokeStyle = colours.coast;
      ctx.stroke();

      /* Limb — the edge of the visible hemisphere */
      ctx.beginPath();
      ctx.arc(view.cx, view.cy, view.radius, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = colours.limb;
      ctx.stroke();

      /* Route between story points */
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = colours.arc;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (const arc of arcs.current) tracePath(ctx, arc, c, view);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Markers */
      const visibleMarkers: { x: number; y: number; index: number }[] = [];
      points.forEach((point, index) => {
        const { x, y, visible } = project(point.location, c, view);
        if (!visible) return;
        visibleMarkers.push({ x, y, index });
        const isActive = index === activeStoryIndex;

        if (isActive) {
          // A slow pulse, so the current chapter is findable at a glance.
          const pulse = 6 + 4 * (0.5 + 0.5 * Math.sin(now / 380));
          ctx.beginPath();
          ctx.arc(x, y, pulse, 0, Math.PI * 2);
          ctx.strokeStyle = colours.active;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(x, y, isActive ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? colours.active : colours.point;
        ctx.fill();
      });
      markerPositions.current = visibleMarkers;
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [points, activeStoryIndex]);

  /* ---- Clicking a marker jumps the story ---- */
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onPointClick) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let closest: { index: number; distance: number } | null = null;
      for (const marker of markerPositions.current) {
        const distance = Math.hypot(marker.x - x, marker.y - y);
        if (distance <= HIT_RADIUS && (!closest || distance < closest.distance)) {
          closest = { index: marker.index, distance };
        }
      }
      if (closest) onPointClick(closest.index);
    },
    [onPointClick],
  );

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="block"
        role="img"
        aria-label={`Globe showing ${points.length} places in the story, currently centred on ${points[activeStoryIndex]?.location.name ?? 'the route'}`}
      />
    </div>
  );
}
