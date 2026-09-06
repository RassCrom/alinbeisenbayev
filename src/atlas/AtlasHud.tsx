import { useEffect, useMemo, useRef } from 'react';
import { SETTLEMENT_SPRITES, islandSprite } from './assets.ts';
import { visibleWorld, type Point, type ViewStore } from './camera.ts';
import { TIERS, TIER_LABEL } from './config.ts';
import { paintingHalfWidth } from './layout.ts';
import type { Atlas } from './types.ts';

/*
 * The two dark-glass panels from concept 10. Bottom left: compass, weather
 * readout (placeholder values until stage 4 wires Open-Meteo), the survey
 * count, and a minimap of the paintings that doubles as the category
 * legend and recentres the camera when clicked. Bottom right: the
 * settlement tier legend and the switch back to the sheet view.
 */

interface Props {
  atlas: Atlas;
  store: ViewStore;
  surveyedCount: number;
  onSheetView: () => void;
  /** A click on the minimap, in world coordinates. */
  onMinimapClick: (point: Point) => void;
}

export default function AtlasHud({ atlas, store, surveyedCount, onSheetView, onMinimapClick }: Props) {
  const counts = useMemo(() => {
    const byTier = new Map<string, number>();
    for (const settlement of atlas.settlements) byTier.set(settlement.tier, (byTier.get(settlement.tier) ?? 0) + 1);
    return byTier;
  }, [atlas]);

  return (
    <>
      <div className="atlas-hud atlas-hud--left">
        <div className="atlas-hud__block">
          <Compass />
        </div>
        <div className="atlas-hud__divider" />
        <div className="atlas-hud__block atlas-weather" title="Placeholder until stage 4 brings the live Astana forecast">
          <SnowIcon />
          <span className="atlas-weather__temperature">−2°C</span>
          <span className="atlas-weather__wind">NW 15 km/h</span>
          <span className="atlas-weather__place">Astana</span>
        </div>
        <div className="atlas-hud__divider" />
        <div className="atlas-hud__block">
          <Minimap atlas={atlas} store={store} onClick={onMinimapClick} />
          <span className="atlas-surveyed" aria-live="polite">
            surveyed {surveyedCount} of {atlas.settlements.length} settlements
          </span>
        </div>
        <div className="atlas-hud__block atlas-legend" aria-label="Islands">
          {atlas.islands.map((island) => (
            <div key={island.id} style={{ display: 'contents' }}>
              <span className="atlas-legend__name">{island.name}</span>
              <span className="atlas-legend__category">
                {island.category} · {island.projectCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="atlas-hud atlas-hud--right">
        <span className="atlas-hud__eyebrow">Settlements</span>
        <div className="atlas-tiers" aria-label="Settlement tiers">
          {TIERS.map((tier) => (
            <div key={tier} style={{ display: 'contents' }}>
              <img src={SETTLEMENT_SPRITES[tier].src} alt="" />
              <span>{TIER_LABEL[tier]}</span>
              <span className="atlas-tiers__count">{counts.get(tier) ?? 0}</span>
            </div>
          ))}
        </div>
        <button type="button" className="atlas-button" onClick={onSheetView}>
          Sheet view
        </button>
      </div>
    </>
  );
}

/** The paintings at their world positions, plus the rectangle the camera shows. */
function Minimap({ atlas, store, onClick }: { atlas: Atlas; store: ViewStore; onClick: (point: Point) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rectRef = useRef<SVGRectElement>(null);
  const box = useMemo(() => {
    const pad = 0.035;
    const b = atlas.bounds;
    return { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + 2 * pad, h: b.maxY - b.minY + 2 * pad };
  }, [atlas]);

  useEffect(
    () =>
      store.subscribe(({ camera, viewport }) => {
        const rect = rectRef.current;
        if (!rect) return;
        const visible = visibleWorld(camera, viewport);
        rect.setAttribute('x', String(visible.minX));
        rect.setAttribute('y', String(visible.minY));
        rect.setAttribute('width', String(visible.maxX - visible.minX));
        rect.setAttribute('height', String(visible.maxY - visible.minY));
      }),
    [store],
  );

  /** Screen point to world, honouring the letterboxing of preserveAspectRatio "meet". */
  const toWorld = (event: React.MouseEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current!;
    const bounds = svg.getBoundingClientRect();
    const scale = Math.min(bounds.width / box.w, bounds.height / box.h);
    const offsetX = (bounds.width - box.w * scale) / 2;
    const offsetY = (bounds.height - box.h * scale) / 2;
    return {
      x: box.x + (event.clientX - bounds.left - offsetX) / scale,
      y: box.y + (event.clientY - bounds.top - offsetY) / scale,
    };
  };

  return (
    <svg
      ref={svgRef}
      className="atlas-minimap"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Minimap of the archipelago; click to move the view"
      onClick={(event) => onClick(toWorld(event))}
    >
      {atlas.islands.map((island) => {
        const half = paintingHalfWidth(island);
        return (
          <image
            key={island.id}
            href={islandSprite(island.id).src}
            x={island.x - half}
            y={island.y - half}
            width={2 * half}
            height={2 * half}
          />
        );
      })}
      <rect ref={rectRef} className="atlas-minimap__viewport" x="0" y="0" width="0" height="0" />
    </svg>
  );
}

function Compass() {
  const gold = 'var(--atlas-gold)';
  return (
    <svg className="atlas-compass" viewBox="-40 -40 80 80" role="img" aria-label="Compass, north up">
      <circle r="36" fill="none" stroke={gold} strokeOpacity="0.45" strokeWidth="0.8" />
      <circle r="30" fill="none" stroke={gold} strokeOpacity="0.25" strokeWidth="0.6" />
      <g fill={gold} fillOpacity="0.55">
        <polygon points="0,-28 4,-4 -4,-4" />
        <polygon points="0,28 4,4 -4,4" />
        <polygon points="-28,0 -4,4 -4,-4" />
        <polygon points="28,0 4,4 4,-4" />
      </g>
      <g fill={gold} fillOpacity="0.28">
        <polygon points="18,-18 3,-1 1,-3" />
        <polygon points="18,18 3,1 1,3" />
        <polygon points="-18,18 -3,1 -1,3" />
        <polygon points="-18,-18 -3,-1 -1,-3" />
      </g>
      <polygon points="0,-28 4,-4 -4,-4" fill="#efe6d0" />
      <circle r="2" fill="#efe6d0" />
      <g fill="#efe6d0" fontFamily="var(--atlas-serif)" fontSize="8" textAnchor="middle">
        <text y="-31">N</text>
        <text y="37">S</text>
        <text x="-34" y="3">W</text>
        <text x="34" y="3">E</text>
      </g>
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg className="atlas-weather__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" />
      <path d="M12 6l-2-2m2 2 2-2M12 18l-2 2m2-2 2 2M6 12l-2-2m2 2-2 2M18 12l2-2m-2 2 2 2" />
    </svg>
  );
}
