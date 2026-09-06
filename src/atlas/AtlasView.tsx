import { useEffect, useMemo, useRef, useState } from 'react';
import { projects } from '../data/projects';
import { usePageMeta } from '../hooks/usePageMeta';
import AtlasHud from './AtlasHud';
import AtlasLabels from './AtlasLabels';
import AtlasLanes from './AtlasLanes';
import { loadImages, textureSources } from './assets.ts';
import { createViewStore, fitBounds } from './camera.ts';
import { AtlasRenderer } from './gl/renderer.ts';
import { buildAtlas } from './index.ts';
import { setViewMode } from './viewMode.ts';
import './atlas.css';

/*
 * The atlas at `/`: one WebGL canvas for sea, islands and settlements, and
 * DOM layers above it for lanes, labels and the HUD. This component owns
 * the single requestAnimationFrame loop; it stops while the tab is hidden
 * and on unmount, which is what happens when the sheet view takes over.
 */

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

/** Above 2 the sea shader costs more than it shows. */
const MAX_DPR = 2;

export default function AtlasView() {
  usePageMeta();
  const atlas = useMemo(() => buildAtlas(projects), []);
  const store = useMemo(
    () => createViewStore({ camera: { x: 0.5, y: 0.5, zoom: 800 }, viewport: { width: 1, height: 1 } }),
    [],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  // Dev only: lets the console and the browser tooling read the layout and camera.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debugWindow = window as unknown as { __atlas?: unknown };
    debugWindow.__atlas = { atlas, store };
    return () => {
      delete debugWindow.__atlas;
    };
  }, [atlas, store]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: AtlasRenderer | null = null;
    let frame = 0;
    let cancelled = false;
    const dpr = (): number => Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const fit = (): void => {
      const rect = container.getBoundingClientRect();
      // A container measured mid-layout can report 0×0; a camera fitted to
      // that is useless, and the resize observer calls again once it has a size.
      if (rect.width < 2 || rect.height < 2) return;
      const viewport = { width: rect.width, height: rect.height };
      store.set({ viewport, camera: fitBounds(atlas.bounds, viewport) });
      renderer?.resize(viewport.width, viewport.height, dpr());
    };

    const tick = (now: number): void => {
      frame = 0;
      if (!renderer || document.hidden) return;
      renderer.render(store.get().camera, dpr(), now / 1000);
      frame = requestAnimationFrame(tick);
    };
    const start = (): void => {
      if (frame === 0 && renderer && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const stop = (): void => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = (): void => (document.hidden ? stop() : start());

    loadImages(textureSources(atlas.islands.map((island) => island.id)))
      .then((images) => {
        if (cancelled) return;
        renderer = new AtlasRenderer(canvas, atlas, images);
        fit();
        setStatus({ kind: 'ready' });
        start();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      });

    const observer = new ResizeObserver(() => fit());
    observer.observe(container);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer?.dispose();
      renderer = null;
    };
  }, [atlas, store]);

  return (
    <div ref={containerRef} className="atlas-view" data-atlas-status={status.kind}>
      <canvas ref={canvasRef} aria-hidden="true" />
      {status.kind === 'ready' && (
        <>
          <AtlasLanes atlas={atlas} store={store} />
          <AtlasLabels atlas={atlas} store={store} />
          <AtlasHud atlas={atlas} store={store} onSheetView={() => setViewMode('sheet')} />
        </>
      )}
      {status.kind === 'loading' && (
        <div className="atlas-status" role="status">
          Charting the archipelago…
        </div>
      )}
      {status.kind === 'error' && (
        <div className="atlas-status atlas-status--error" role="alert">
          <p>The map could not start on this device.</p>
          <p style={{ opacity: 0.7 }}>{status.message}</p>
          <button type="button" className="atlas-button" onClick={() => setViewMode('sheet')}>
            Sheet view
          </button>
        </div>
      )}
    </div>
  );
}
