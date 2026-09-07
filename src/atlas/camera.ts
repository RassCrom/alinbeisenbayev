import { paintingHalfWidth } from './layout.ts';
import type { Bounds, Island } from './types.ts';

/*
 * The camera and the two coordinate conversions every layer shares. World
 * space is the unit square from src/atlas/types.ts; screen space is CSS
 * pixels from the top-left of the atlas container, y down in both. The
 * renderer multiplies by devicePixelRatio itself.
 */

export interface Camera {
  /** World point at the centre of the viewport. */
  x: number;
  y: number;
  /** CSS pixels per world unit. */
  zoom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function worldToScreen(camera: Camera, viewport: Viewport, x: number, y: number): Point {
  return {
    x: (x - camera.x) * camera.zoom + viewport.width / 2,
    y: (y - camera.y) * camera.zoom + viewport.height / 2,
  };
}

export function screenToWorld(camera: Camera, viewport: Viewport, x: number, y: number): Point {
  return {
    x: (x - viewport.width / 2) / camera.zoom + camera.x,
    y: (y - viewport.height / 2) / camera.zoom + camera.y,
  };
}

/** The camera that shows all of `bounds` with `padding` of the viewport left clear on each side. */
export function fitBounds(bounds: Bounds, viewport: Viewport, padding = 0.08): Camera {
  const width = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const height = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const zoom = Math.min(viewport.width / width, viewport.height / height) * (1 - 2 * padding);
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, zoom };
}

/** The world rectangle the viewport currently shows. */
export function visibleWorld(camera: Camera, viewport: Viewport): Bounds {
  const topLeft = screenToWorld(camera, viewport, 0, 0);
  const bottomRight = screenToWorld(camera, viewport, viewport.width, viewport.height);
  return { minX: topLeft.x, minY: topLeft.y, maxX: bottomRight.x, maxY: bottomRight.y };
}

/** The square an island's painting covers, with a little sea around it. */
export function islandBounds(island: Island): Bounds {
  const half = paintingHalfWidth(island) * 1.15;
  return { minX: island.x - half, minY: island.y - half, maxX: island.x + half, maxY: island.y + half };
}

/* ---- Limits ---------------------------------------------------------- */

/** Zoom limits as multiples of the fitted zoom. */
export const ZOOM_OUT_LIMIT = 0.7;
export const ZOOM_IN_LIMIT = 9;
/** How far past the archipelago's edge the screen centre may travel, as a fraction of its size. */
const PAN_SLACK = 0.12;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Keep the zoom between the limits and the archipelago on screen: the
 * viewport centre may not leave the bounds by more than a small slack, so
 * at any zoom at least a good part of the islands stays visible.
 */
export function clampCamera(camera: Camera, viewport: Viewport, bounds: Bounds): Camera {
  const fit = fitBounds(bounds, viewport);
  const zoom = clamp(camera.zoom, fit.zoom * ZOOM_OUT_LIMIT, fit.zoom * ZOOM_IN_LIMIT);
  const slackX = (bounds.maxX - bounds.minX) * PAN_SLACK;
  const slackY = (bounds.maxY - bounds.minY) * PAN_SLACK;
  return {
    x: clamp(camera.x, bounds.minX - slackX, bounds.maxX + slackX),
    y: clamp(camera.y, bounds.minY - slackY, bounds.maxY + slackY),
    zoom,
  };
}

/** Scale the zoom by `factor`, keeping the world point under the screen point fixed. */
export function zoomAround(camera: Camera, viewport: Viewport, x: number, y: number, factor: number): Camera {
  const anchor = screenToWorld(camera, viewport, x, y);
  const zoom = camera.zoom * factor;
  return {
    x: anchor.x - (x - viewport.width / 2) / zoom,
    y: anchor.y - (y - viewport.height / 2) / zoom,
    zoom,
  };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---- View store ----------------------------------------------------------
 * Camera and viewport in one place, outside React state: the labels, lanes
 * and minimap subscribe and write to the DOM directly, so a pan or zoom
 * never re-renders the component tree.
 */

export interface View {
  camera: Camera;
  viewport: Viewport;
}

export interface ViewStore {
  get(): View;
  set(next: Partial<View>): void;
  subscribe(listener: (view: View) => void): () => void;
}

export function createViewStore(initial: View): ViewStore {
  let view = initial;
  const listeners = new Set<(view: View) => void>();
  return {
    get: () => view,
    set(next) {
      view = { camera: next.camera ?? view.camera, viewport: next.viewport ?? view.viewport };
      for (const listener of listeners) listener(view);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(view);
      return () => listeners.delete(listener);
    },
  };
}

/* ---- Animation ---------------------------------------------------------- */

export interface CameraAnimator {
  /** Ease the camera to `target` over `duration` ms; resolves when it arrives or is cancelled. */
  to(target: Camera, duration: number): Promise<void>;
  /** Stop the running tween where it is. */
  cancel(): void;
  /** The animator's bounds, applied to every frame. */
  readonly bounds: Bounds;
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * One tween at a time: any new target or user gesture cancels the previous
 * one. Under prefers-reduced-motion every move is a jump. Zoom is
 * interpolated in log space so a zoom-in feels even from start to end.
 */
export function createCameraAnimator(store: ViewStore, bounds: Bounds): CameraAnimator {
  let frame = 0;
  let settle: (() => void) | null = null;

  const apply = (camera: Camera): void => {
    store.set({ camera: clampCamera(camera, store.get().viewport, bounds) });
  };

  const cancel = (): void => {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    settle?.();
    settle = null;
  };

  return {
    bounds,
    cancel,
    to(target, duration) {
      cancel();
      if (duration <= 0 || prefersReducedMotion()) {
        apply(target);
        return Promise.resolve();
      }
      const from = store.get().camera;
      const logFrom = Math.log(from.zoom);
      const logTo = Math.log(target.zoom);
      const start = performance.now();
      return new Promise<void>((resolve) => {
        settle = resolve;
        const step = (now: number): void => {
          const t = Math.min(1, (now - start) / duration);
          const e = easeInOutCubic(t);
          apply({
            x: from.x + (target.x - from.x) * e,
            y: from.y + (target.y - from.y) * e,
            zoom: Math.exp(logFrom + (logTo - logFrom) * e),
          });
          if (t < 1) {
            frame = requestAnimationFrame(step);
          } else {
            frame = 0;
            settle = null;
            resolve();
          }
        };
        frame = requestAnimationFrame(step);
      });
    },
  };
}

/* ---- Saved camera --------------------------------------------------------
 * The camera at the moment a settlement was opened, so Back lands on the
 * exact same view. sessionStorage: it should not outlive the tab.
 */

const CAMERA_KEY = 'atlas:camera';

export function saveCamera(camera: Camera): void {
  try {
    sessionStorage.setItem(CAMERA_KEY, JSON.stringify(camera));
  } catch {
    // Nothing to do: Back will fit the archipelago instead.
  }
}

export function readSavedCamera(): Camera | null {
  try {
    const raw = sessionStorage.getItem(CAMERA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Camera>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number' || typeof parsed.zoom !== 'number') return null;
    return { x: parsed.x, y: parsed.y, zoom: parsed.zoom };
  } catch {
    return null;
  }
}
