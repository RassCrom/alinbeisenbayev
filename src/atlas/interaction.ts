import { SETTLEMENT_SPRITES, SETTLEMENT_SPRITE_SCALE } from './assets.ts';
import { worldToScreen, type Camera, type Viewport } from './camera.ts';
import type { Atlas, Settlement } from './types.ts';

/*
 * Which settlement the visitor is pointing at, by three routes that can
 * coexist: the mouse (hovered), a touch tap (selected) and the keyboard
 * (focused). `active()` is the one the ring, card and lanes follow, in that
 * order of precedence. A trade good (stage 5) highlights a whole set of
 * settlements instead; `highlights()` is the list every layer lights.
 */

export interface ToolHighlight {
  key: string;
  label: string;
  slugs: readonly string[];
}

export interface Interaction {
  hovered: string | null;
  selected: string | null;
  focused: string | null;
  /** The trade good under the pointer, if any. */
  tool: ToolHighlight | null;
  /** A trade good clicked to stay lit. */
  pinnedTool: ToolHighlight | null;
}

export interface InteractionStore {
  get(): Interaction;
  set(patch: Partial<Interaction>): void;
  /** The single settlement in focus, or null. */
  active(): string | null;
  /** The settlements to light: the active one, else the active trade good's. */
  highlights(): readonly string[];
  subscribe(listener: () => void): () => void;
}

const NONE: readonly string[] = [];

export function createInteractionStore(): InteractionStore {
  let state: Interaction = { hovered: null, selected: null, focused: null, tool: null, pinnedTool: null };
  let highlightCache: readonly string[] = NONE;
  const listeners = new Set<() => void>();

  const recompute = (): void => {
    const active = state.hovered ?? state.selected ?? state.focused;
    const tool = state.tool ?? state.pinnedTool;
    highlightCache = active ? [active] : tool ? tool.slugs : NONE;
  };

  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      if (
        next.hovered === state.hovered &&
        next.selected === state.selected &&
        next.focused === state.focused &&
        next.tool === state.tool &&
        next.pinnedTool === state.pinnedTool
      ) {
        return;
      }
      state = next;
      recompute();
      for (const listener of listeners) listener();
    },
    active: () => state.hovered ?? state.selected ?? state.focused,
    highlights: () => highlightCache,
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
 * A sprite smaller than this on screen (a hamlet at the fitted view is
 * about eight pixels wide) still takes the pointer within this half-size,
 * so the small works are not harder to reach than the large ones.
 */
const MIN_HIT_HALF = 14;

/** Front-most first: sprites are drawn back to front by y, so the one lowest on screen wins an overlap. */
const frontFirst = new WeakMap<Atlas, Settlement[]>();
function orderedFrontFirst(atlas: Atlas): Settlement[] {
  let ordered = frontFirst.get(atlas);
  if (!ordered) {
    ordered = [...atlas.settlements].sort((a, b) => b.y - a.y);
    frontFirst.set(atlas, ordered);
  }
  return ordered;
}

/** The settlement under a screen point, or null. */
export function hitTest(atlas: Atlas, camera: Camera, viewport: Viewport, x: number, y: number): string | null {
  for (const settlement of orderedFrontFirst(atlas)) {
    const rect = spriteRect(settlement, camera, viewport);
    const slackX = Math.max(0, MIN_HIT_HALF - (rect.right - rect.left) / 2);
    const slackY = Math.max(0, MIN_HIT_HALF - (rect.bottom - rect.top) / 2);
    if (x >= rect.left - slackX && x <= rect.right + slackX && y >= rect.top - slackY && y <= rect.bottom + slackY) {
      return settlement.slug;
    }
  }
  return null;
}
