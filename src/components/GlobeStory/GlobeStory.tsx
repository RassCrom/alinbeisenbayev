import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { PerspectiveCamera } from 'three';
import type { StoryPoint } from '../../types';

// NASA Black Marble (public domain) — dark earth texture.
// Served from unpkg because eoimages.gsfc.nasa.gov sends no CORS headers,
// which blocks WebGL texture upload (same imagery, CORS-enabled host).
const EARTH_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-night.jpg';

export interface GlobeStoryHandle {
  pointOfView: (
    view: { lat: number; lng: number; altitude: number },
    duration?: number,
  ) => void;
}

export interface GlobeStoryProps {
  points: StoryPoint[];
  activeStoryIndex: number;
  /** Intro mode: slow cinematic spin before the scroll story takes over */
  autoRotate?: boolean;
  /** Called with the story index when the user clicks a point on the globe */
  onPointClick?: (index: number) => void;
}

interface OrbitControlsLike {
  autoRotate: boolean;
  autoRotateSpeed: number;
}

/**
 * The smallest `altitude` (globe-radius units, per react-globe.gl's
 * pointOfView) that keeps the full sphere inside a frame of the given
 * aspect ratio and vertical FOV, plus a margin so it doesn't touch the
 * edges. Distance = radius * (1 + altitude), and to fit a sphere of
 * radius r at distance d within a half-angle theta: sin(theta) = r/d.
 * Solving for altitude with theta = the *narrower* of the frame's two
 * half-FOVs (whichever axis is tighter) and radius cancelling out of
 * both sides leaves a formula independent of the globe's actual size.
 */
function minAltitudeForFrame(cameraFovDeg: number, aspect: number, margin = 1.05): number {
  const vHalf = (cameraFovDeg * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const tightestHalf = Math.min(vHalf, hHalf);
  return margin / Math.sin(tightestHalf) - 1;
}

const GlobeStory = forwardRef<GlobeStoryHandle, GlobeStoryProps>(function GlobeStory(
  { points, activeStoryIndex, autoRotate = false, onPointClick },
  ref,
) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    pointOfView: (view, duration = 1500) => {
      globeRef.current?.pointOfView(view, duration);
    },
  }));

  // Fly to the story point for the panel currently in view (paused while the
  // intro spin is running). The requested altitude is a floor, not a fixed
  // value — narrow/tall columns (mobile, or the 35% desktop rail) need more
  // distance than the data specifies to keep the sphere from clipping.
  useEffect(() => {
    if (autoRotate) return;
    const point = points[activeStoryIndex];
    const globe = globeRef.current;
    if (!point || !globe || size.width === 0 || size.height === 0) return;
    const { lat, lng, altitude, animationDuration } = point.globeView;
    const fov = (globe.camera() as PerspectiveCamera).fov;
    const minAltitude = minAltitudeForFrame(fov, size.width / size.height);
    globe.pointOfView({ lat, lng, altitude: Math.max(altitude, minAltitude) }, animationDuration);
  }, [activeStoryIndex, points, autoRotate, size]);

  // Intro spin on/off
  useEffect(() => {
    const controls = globeRef.current?.controls() as OrbitControlsLike | undefined;
    if (!controls) return;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.9;
  }, [autoRotate]);

  const markers = useMemo(
    () =>
      points.map((point, index) => ({
        lat: point.location.lat,
        lng: point.location.lng,
        index,
        label: point.title,
      })),
    [points],
  );

  // Arc lines connecting story points in sequence
  const arcs = useMemo(
    () =>
      points.slice(0, -1).map((point, index) => ({
        startLat: point.location.lat,
        startLng: point.location.lng,
        endLat: points[index + 1].location.lat,
        endLng: points[index + 1].location.lng,
      })),
    [points],
  );

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={EARTH_TEXTURE}
          showAtmosphere
          atmosphereColor="#4472a8"
          atmosphereAltitude={0.22}
          pointsData={markers}
          pointColor={(d) =>
            (d as { index: number }).index === activeStoryIndex ? '#9e7f4a' : '#6691c0'
          }
          pointAltitude={0.015}
          pointRadius={0.5}
          pointLabel={(d) => (d as { label: string }).label}
          onPointClick={(d) => onPointClick?.((d as { index: number }).index)}
          ringsData={markers}
          ringColor={() => '#6691c0'}
          ringMaxRadius={3}
          ringPropagationSpeed={1.2}
          ringRepeatPeriod={1400}
          arcsData={arcs}
          arcColor={() => 'rgba(68, 114, 168, 0.6)'}
          arcAltitude={0.15}
          arcStroke={0.35}
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={4000}
          onGlobeReady={() => {
            const first = points[0];
            const globe = globeRef.current;
            if (first && globe) {
              const fov = (globe.camera() as PerspectiveCamera).fov;
              const minAltitude = minAltitudeForFrame(fov, size.width / size.height);
              // Wide framing during the intro spin; the story effect zooms in after
              globe.pointOfView(
                {
                  lat: first.globeView.lat,
                  lng: first.globeView.lng,
                  altitude: Math.max(autoRotate ? 2.8 : first.globeView.altitude, minAltitude),
                },
                0,
              );
            }
            const controls = globeRef.current?.controls() as OrbitControlsLike | undefined;
            if (controls) {
              controls.autoRotate = autoRotate;
              controls.autoRotateSpeed = 0.9;
            }
          }}
        />
      )}
    </div>
  );
});

export default GlobeStory;
