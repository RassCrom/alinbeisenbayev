import { useEffect, useMemo, useRef } from 'react';
import { SETTLEMENT_SPRITES, islandSprite } from './assets.ts';
import { visibleWorld, type Point, type ViewStore } from './camera.ts';
import { TIERS, TIER_LABEL } from './config.ts';
import { paintingHalfWidth } from './layout.ts';
import type { Atlas } from './types.ts';
import { moonPhase } from './weather/sun.ts';
import {
  CONDITION_LABEL,
  PRESET_LABEL,
  compassPoint,
  formatTemperature,
  type Condition,
  type WeatherPreset,
  type WeatherState,
} from './weather/weather.ts';

/*
 * The two dark-glass panels from concept 10. Bottom left: compass, the
 * live weather readout with a preview picker, the survey count, and a
 * minimap of the paintings that doubles as the category legend and
 * recentres the camera when clicked. Bottom right: the settlement tier
 * legend and the switch back to the sheet view. At night a moon with the
 * real phase hangs at the top right of the map.
 */

interface Props {
  atlas: Atlas;
  store: ViewStore;
  surveyedCount: number;
  weather: WeatherState;
  weatherError: string | null;
  preset: WeatherPreset | null;
  onPreset: (preset: WeatherPreset | null) => void;
  onSheetView: () => void;
  /** A click on the minimap, in world coordinates. */
  onMinimapClick: (point: Point) => void;
}

const PRESETS = Object.keys(PRESET_LABEL) as WeatherPreset[];

export default function AtlasHud({
  atlas,
  store,
  surveyedCount,
  weather,
  weatherError,
  preset,
  onPreset,
  onSheetView,
  onMinimapClick,
}: Props) {
  const counts = useMemo(() => {
    const byTier = new Map<string, number>();
    for (const settlement of atlas.settlements) byTier.set(settlement.tier, (byTier.get(settlement.tier) ?? 0) + 1);
    return byTier;
  }, [atlas]);

  const sourceNote =
    preset !== null
      ? 'Preview weather; the live forecast is unchanged.'
      : weather.source === 'live'
        ? `Open-Meteo, ${new Date(weather.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : weather.source === 'cached'
          ? 'Cached forecast; refreshing every fifteen minutes.'
          : `No forecast reachable${weatherError ? ` (${weatherError})` : ''}; clear sky from the clock.`;

  return (
    <>
      {!weather.isDay && <Moon />}

      <div className="atlas-hud atlas-hud--left">
        <div className="atlas-hud__block">
          <Compass />
        </div>
        <div className="atlas-hud__divider" />
        <div className="atlas-hud__block atlas-weather" title={sourceNote}>
          <WeatherIcon condition={weather.condition} isDay={weather.isDay} />
          <span className="atlas-weather__temperature">{formatTemperature(weather.temperature)}</span>
          <span className="atlas-weather__wind">
            {compassPoint(weather.windDirection)} {Math.round(weather.windSpeed)} km/h · {CONDITION_LABEL[weather.condition]}
          </span>
          <span className="atlas-weather__place">The map lives in Astana's weather.</span>
          <label className="atlas-weather__preview">
            <span className="atlas-hud__eyebrow">Preview</span>
            <select
              value={preset ?? 'live'}
              onChange={(event) => onPreset(event.target.value === 'live' ? null : (event.target.value as WeatherPreset))}
              aria-label="Preview the map under another weather"
            >
              <option value="live">Live Astana</option>
              {PRESETS.map((key) => (
                <option key={key} value={key}>
                  {PRESET_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
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

/** The real lunar phase, drawn as the lit part of a disc. */
function Moon() {
  const { phase, illumination, waxing } = moonPhase(new Date());
  const r = 14;
  // The terminator is an ellipse whose x radius runs from -r (new) through 0 (quarter) to r (full).
  const terminator = r * Math.cos(2 * Math.PI * phase);
  const litSide = waxing ? 1 : -1;
  const outer = `M0,${-r} A${r},${r} 0 0,${waxing ? 1 : 0} 0,${r}`;
  const inner = `A${Math.abs(terminator)},${r} 0 0,${(terminator * litSide < 0) === waxing ? 0 : 1} 0,${-r}`;
  const label = `${Math.round(illumination * 100)}% lit, ${waxing ? 'waxing' : 'waning'}`;
  return (
    <svg className="atlas-moon" viewBox="-18 -18 36 36" role="img" aria-label={`Moon, ${label}`}>
      <circle r={r} fill="#1a2238" stroke="rgba(235,225,201,0.25)" strokeWidth="0.6" />
      <path d={`${outer} ${inner} Z`} fill="#efe6d0" />
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

function WeatherIcon({ condition, isDay }: { condition: Condition; isDay: boolean }) {
  const common = {
    className: 'atlas-weather__icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  const cloud = <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.6A3.3 3.3 0 0 0 7 18z" />;
  switch (condition) {
    case 'clear':
      return isDay ? (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
        </svg>
      ) : (
        <svg {...common}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
        </svg>
      );
    case 'partly-cloudy':
      return (
        <svg {...common}>
          <path d="M6 5.5v1.5M2.5 9H4M4 4.5l1 1M9.5 4.5l-1 1" />
          <circle cx="6" cy="9" r="2.2" />
          <path d="M9 19h9a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.3 1.5A2.8 2.8 0 0 0 9 19z" />
        </svg>
      );
    case 'overcast':
      return <svg {...common}>{cloud}</svg>;
    case 'fog':
      return (
        <svg {...common}>
          <path d="M4 9h16M3 13h18M5 17h14" />
        </svg>
      );
    case 'drizzle':
    case 'rain':
      return (
        <svg {...common}>
          <path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.6A3.3 3.3 0 0 0 7 15z" />
          <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
        </svg>
      );
    case 'snow':
      return (
        <svg {...common}>
          <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" />
        </svg>
      );
    case 'thunderstorm':
      return (
        <svg {...common}>
          <path d="M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.6A3.3 3.3 0 0 0 7 14z" />
          <path d="M13 14l-2.5 4.5H13L11 23" />
        </svg>
      );
    default:
      return <svg {...common}>{cloud}</svg>;
  }
}
