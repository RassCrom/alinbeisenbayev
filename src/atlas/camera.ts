import type { Bounds } from './types.ts';

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

/* ---- View store ----------------------------------------------------------
 * Camera and viewport in one place, outside React state: the labels, lanes
 * and minimap subscribe and write to the DOM directly, so a pan or zoom
 * (stage 3) never re-renders the component tree.
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
