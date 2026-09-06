import { useEffect, useMemo, useRef } from 'react';
import { CROWN_SRC, PENNANT_SRC, SETTLEMENT_SPRITES, SETTLEMENT_SPRITE_SCALE } from './assets.ts';
import { fitBounds, worldToScreen, type Camera, type ViewStore, type Viewport } from './camera.ts';
import { TIERS } from './config.ts';
import { paintingHalfWidth } from './layout.ts';
import type { Atlas, Tier } from './types.ts';

/*
 * Island and settlement names as DOM text above the canvas, so they stay
 * crisp, selectable by assistive tech later, and cheap to restyle. Every
 * label is rendered once; the view store moves them with transforms.
 *
 * Placement is greedy, in two passes. Settlements go first, in tier order
 * then score, the capital ahead of all: each tries above its sprite, then
 * below, and is hidden when both would overlap a label already placed.
 * Hamlets and ruins only take part once the camera is zoomed past one and a
 * half times the fitted view. Island names go second and always show; they
 * float upward, over open sea, until they clear whatever is beneath them.
 */

interface Props {
  atlas: Atlas;
  store: ViewStore;
}

interface SettlementItem {
  key: string;
  tier: Tier;
  x: number;
  /** World y the label hangs from when placed above the sprite. */
  above: number;
  /** World y the label starts from when placed below the sprite. */
  below: number;
}

interface IslandItem {
  key: string;
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zoom, as a multiple of the fitted zoom, at which the smallest tiers get labels. */
const SMALL_LABEL_ZOOM = 1.5;
/** Clearance between two labels, in CSS pixels. */
const GAP = 4;
/** How far, in CSS pixels per step, an island name climbs to clear a settlement label. */
const ISLAND_NUDGE = 10;
const ISLAND_NUDGE_STEPS = 8;
const MAX_TITLE = 30;

const TIER_RANK = new Map(TIERS.map((tier, index) => [tier, index]));

export function shortTitle(title: string): string {
  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1).trimEnd()}…` : title;
}

export default function AtlasLabels({ atlas, store }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  const islandItems = useMemo<IslandItem[]>(
    () =>
      atlas.islands.map((island) => ({
        key: `island:${island.id}`,
        x: island.x,
        y: island.y - paintingHalfWidth(island) - 0.006,
      })),
    [atlas],
  );

  const settlementItems = useMemo<SettlementItem[]>(
    () =>
      [...atlas.settlements]
        .sort(
          (a, b) =>
            Number(b.isCapital) - Number(a.isCapital) ||
            (TIER_RANK.get(a.tier) ?? 9) - (TIER_RANK.get(b.tier) ?? 9) ||
            b.score - a.score,
        )
        .map((settlement) => {
          const anchorY = SETTLEMENT_SPRITES[settlement.tier].anchor.y;
          const half = settlement.footprint * SETTLEMENT_SPRITE_SCALE;
          return {
            key: `settlement:${settlement.slug}`,
            tier: settlement.tier,
            x: settlement.x,
            above: settlement.y - anchorY * 2 * half - 0.004,
            below: settlement.y + (1 - anchorY) * 2 * half + 0.004,
          };
        }),
    [atlas],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const elements = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-label]').forEach((element) => {
      elements.set(element.dataset.label ?? '', element);
    });
    const sizes = new Map<string, { w: number; h: number }>();
    const measure = (): void => {
      for (const [key, element] of elements) sizes.set(key, { w: element.offsetWidth, h: element.offsetHeight });
    };

    const place = (): void => {
      const { camera, viewport } = store.get();
      const showSmall = camera.zoom >= fitBounds(atlas.bounds, viewport).zoom * SMALL_LABEL_ZOOM;
      const kept: Rect[] = [];
      const show = (element: HTMLElement, rect: Rect): void => {
        element.style.transform = `translate(${rect.x.toFixed(1)}px, ${rect.y.toFixed(1)}px)`;
        element.classList.add('is-placed');
        kept.push(rect);
      };
      const hide = (element: HTMLElement): void => element.classList.remove('is-placed');
      const clear = (rect: Rect): boolean => !kept.some((other) => overlaps(other, rect));

      for (const item of settlementItems) {
        const element = elements.get(item.key);
        const size = sizes.get(item.key);
        if (!element || !size) continue;
        const small = item.tier === 'hamlet' || item.tier === 'ruin';
        if (small && !showSmall) {
          hide(element);
          continue;
        }
        const candidates = [
          hangingFrom(camera, viewport, item.x, item.above, size),
          startingAt(camera, viewport, item.x, item.below, size),
        ];
        const rect = candidates.find((candidate) => onScreen(candidate, viewport) && clear(candidate));
        if (rect) show(element, rect);
        else hide(element);
      }

      for (const item of islandItems) {
        const element = elements.get(item.key);
        const size = sizes.get(item.key);
        if (!element || !size) continue;
        const base = hangingFrom(camera, viewport, item.x, item.y, size);
        let rect = base;
        for (let step = 1; step <= ISLAND_NUDGE_STEPS && !clear(rect); step++) {
          rect = { ...base, y: base.y - step * ISLAND_NUDGE };
        }
        if (onScreen(rect, viewport)) show(element, rect);
        else hide(element);
      }
    };

    measure();
    const unsubscribe = store.subscribe(place);
    // Web fonts arriving after mount change label widths; measure again then.
    let active = true;
    document.fonts?.ready.then(() => {
      if (!active) return;
      measure();
      place();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [atlas, islandItems, settlementItems, store]);

  return (
    <div ref={rootRef} className="atlas-labels" aria-hidden="true">
      {atlas.islands.map((island) => (
        <div key={island.id} data-label={`island:${island.id}`} className="atlas-label atlas-label--island">
          {island.name}
        </div>
      ))}
      {atlas.settlements.map((settlement) => (
        <div
          key={settlement.slug}
          data-label={`settlement:${settlement.slug}`}
          className={`atlas-label atlas-label--${settlement.tier}`}
          title={settlement.title}
        >
          {settlement.isCapital && <img className="atlas-label__crown" src={CROWN_SRC} alt="" />}
          <span className="atlas-label__text">
            {shortTitle(settlement.title)}
            {settlement.hasPennant && <img className="atlas-label__pennant" src={PENNANT_SRC} alt="" />}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The label box whose bottom centre sits on the world point. */
function hangingFrom(camera: Camera, viewport: Viewport, x: number, y: number, size: { w: number; h: number }): Rect {
  const point = worldToScreen(camera, viewport, x, y);
  return { x: point.x - size.w / 2, y: point.y - size.h, w: size.w, h: size.h };
}

/** The label box whose top centre sits on the world point. */
function startingAt(camera: Camera, viewport: Viewport, x: number, y: number, size: { w: number; h: number }): Rect {
  const point = worldToScreen(camera, viewport, x, y);
  return { x: point.x - size.w / 2, y: point.y, w: size.w, h: size.h };
}

function onScreen(rect: Rect, viewport: Viewport): boolean {
  return rect.x + rect.w > 0 && rect.x < viewport.width && rect.y + rect.h > 0 && rect.y < viewport.height;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y;
}
