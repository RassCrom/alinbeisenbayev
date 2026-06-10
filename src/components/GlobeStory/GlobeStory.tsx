import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
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
}

interface OrbitControlsLike {
  autoRotate: boolean;
  autoRotateSpeed: number;
}

const GlobeStory = forwardRef<GlobeStoryHandle, GlobeStoryProps>(function GlobeStory(
  { points, activeStoryIndex, autoRotate = false },
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
  // intro spin is running)
  useEffect(() => {
    if (autoRotate) return;
    const point = points[activeStoryIndex];
    if (!point || !globeRef.current) return;
    const { lat, lng, altitude, animationDuration } = point.globeView;
    globeRef.current.pointOfView({ lat, lng, altitude }, animationDuration);
  }, [activeStoryIndex, points, autoRotate]);

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
            if (first) {
              // Wide framing during the intro spin; the story effect zooms in after
              globeRef.current?.pointOfView(
                {
                  lat: first.globeView.lat,
                  lng: first.globeView.lng,
                  altitude: autoRotate ? 2.8 : first.globeView.altitude,
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
