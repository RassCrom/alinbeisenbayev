import { SETTLEMENT_SPRITES, SETTLEMENT_SPRITE_SCALE } from './assets.ts';
import { worldToScreen, type Camera, type Viewport } from './camera.ts';
import type { Atlas, Settlement } from './types.ts';

/*
 * Which settlement the visitor is pointing at, by three routes that can
 * coexist: the mouse (hovered), a touch tap (selected) and the keyboard
 * (focused). `active()` is the one the ring, tooltip and lanes follow, in
 * that order of precedence.
 */

export interface Interaction {
  hovered: string | null;
  selected: string | null;
  focused: string | null;
}

export interface InteractionStore {
  get(): Interaction;
  set(patch: Partial<Interaction>): void;
  active(): string | null;
  subscribe(listener: () => void): () => void;
}

export function createInteractionStore(): InteractionStore {
  let state: Interaction = { hovered: null, selected: null, focused: null };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      if (next.hovered === state.hovered && next.selected === state.selected && next.focused === state.focused) return;
      state = next;
      for (const listener of listeners) listener();
    },
    active: () => state.hovered ?? state.selected ?? state.focused,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The screen rectangle a settlement's sprite covers. */
export function spriteRect(
  settlement: Settlement,
  camera: Camera,
  viewport: Viewport,
): { left: number; top: number; right: number; bottom: number } {
  const half = settlement.footprint * SETTLEMENT_SPRITE_SCALE;
  const anchorY = SETTLEMENT_SPRITES[settlement.tier].anchor.y;
  const centre = worldToScreen(camera, viewport, settlement.x, settlement.y);
  const size = half * camera.zoom;
  return {
    left: centre.x - size,
    right: centre.x + size,
    top: centre.y - anchorY * 2 * size,
    bottom: centre.y + (1 - anchorY) * 2 * size,
  };
}

/**
 * The settlement under a screen point, front-most first: sprites are drawn
 * back to front by y, so the one lowest on screen wins an overlap.
 */
export function hitTest(atlas: Atlas, camera: Camera, viewport: Viewport, x: number, y: number): string | null {
  const ordered = [...atlas.settlements].sort((a, b) => b.y - a.y);
  for (const settlement of ordered) {
    const rect = spriteRect(settlement, camera, viewport);
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return settlement.slug;
  }
  return null;
}
