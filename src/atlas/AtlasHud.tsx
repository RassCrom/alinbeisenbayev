import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { projects } from '../data/projects';
import type { Project } from '../types';
import { CROWN_SRC, PENNANT_SRC, SETTLEMENT_SPRITES, islandSprite } from './assets.ts';
import { visibleWorld, type Point, type ViewStore } from './camera.ts';
import type { AmbientAudio } from './audio.ts';
import { formatMonth, yearOf, type ChronicleStore, type Month } from './chronicle.ts';
import type { Quality } from './quality.ts';
import { TIERS, TIER_BLURB, TIER_LABEL, describeCategory } from './config.ts';
import type { InteractionStore } from './interaction.ts';
import { paintingHalfWidth } from './layout.ts';
import type { TradeGood } from './tools.ts';
import type { Tour } from './tour.ts';
import type { Atlas, Island, Settlement } from './types.ts';
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
 * The HUD, kept out of the map's way. What stays on screen:
 *
 *   top left      the title of the chart ("Atlas of works · 29 projects on
 *                 7 islands"), which opens the explainer, and the timeline
 *                 as one pill ("Today"); a click opens the slider;
 *   bottom left   compass, the weather in one line, the minimap, and how
 *                 much of the map has been explored;
 *   right         a rail of icon buttons: zoom, show all, find a work, the
 *                 legend, how to read the map, the tour, sound, save as
 *                 image, and the switch to the list view.
 *
 * Everything else lives in a drawer beside the rail: the legend (sizes,
 * islands with their native names, where the works were made, the tools),
 * the finder, and the explainer, which opens by itself on a first visit.
 * At night a moon with the real phase hangs at the top of the map.
 */

export type Drawer = 'legend' | 'find' | 'help' | null;

interface Props {
  atlas: Atlas;
  store: ViewStore;
  interaction: InteractionStore;
  chronicle: ChronicleStore;
  range: { first: Month; last: Month };
  audio: AmbientAudio;
  quality: Quality;
  exporting: boolean;
  onExport: () => void;
  /** Tools and cities, each a set of settlements the legend can light. */
  goods: readonly TradeGood[];
  ports: readonly TradeGood[];
  tour: Tour;
  drawer: Drawer;
  onDrawer: (next: Drawer) => void;
  /** True during the first-visit flight; the panels fade in as it lands. */
  arriving: boolean;
  surveyedCount: number;
  weather: WeatherState;
  weatherError: string | null;
  preset: WeatherPreset | null;
  onPreset: (preset: WeatherPreset | null) => void;
  onListView: () => void;
  /** A click on the minimap, in world coordinates. */
  onMinimapClick: (point: Point) => void;
  /** The rail's zoom buttons: a factor about the viewport centre. */
  onZoom: (factor: number) => void;
  onFit: () => void;
  onIslandClick: (island: Island) => void;
  /** Fly to a settlement and show its card. */
  onGoTo: (slug: string) => void;
}

const PRESETS = Object.keys(PRESET_LABEL) as WeatherPreset[];
/** Chips shown; the rest of the tags stay in the list view's filters. */
const MAX_GOODS = 12;
const RAIL_ZOOM = 1.6;
const TIER_RANK = new Map(TIERS.map((tier, index) => [tier, index]));

export default function AtlasHud({
  atlas,
  store,
  interaction,
  chronicle,
  range,
  audio,
  quality,
  exporting,
  onExport,
  goods,
  ports,
  tour,
  drawer,
  onDrawer,
  arriving,
  surveyedCount,
  weather,
  weatherError,
  preset,
  onPreset,
  onListView,
  onMinimapClick,
  onZoom,
  onFit,
  onIslandClick,
  onGoTo,
}: Props) {
  const total = atlas.settlements.length;
  const toggle = (which: Exclude<Drawer, null>): void => onDrawer(drawer === which ? null : which);
  const close = (): void => onDrawer(null);
  const tourState = useSyncExternalStore(tour.subscribe, tour.get);

  const sourceNote =
    preset !== null
      ? 'Preview weather; the live forecast is unchanged.'
      : weather.source === 'live'
        ? `Open-Meteo, ${new Date(weather.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : weather.source === 'cached'
          ? 'Cached forecast; refreshing every fifteen minutes.'
          : `No forecast reachable${weatherError ? ` (${weatherError})` : ''}; clear sky from the clock.`;

  const arrivingClass = arriving ? ' is-arriving' : '';

  return (
    <>
      {!weather.isDay && <Moon arriving={arriving} />}

      <div className={`atlas-topbar${arrivingClass}`}>
        <button
          type="button"
          className={`atlas-hud atlas-title${drawer === 'help' ? ' is-on' : ''}`}
          onClick={() => toggle('help')}
          aria-expanded={drawer === 'help'}
          title="What this map is, and how to read it"
        >
          <span className="atlas-hud__eyebrow">Atlas of works</span>
          <span className="atlas-title__text">
            {total} projects on {atlas.islands.length} islands
          </span>
        </button>
        <Timeline atlas={atlas} store={chronicle} range={range} />
      </div>

      <div className={`atlas-hud atlas-hud--left${arrivingClass}`}>
        <div className="atlas-hud__row">
          <Compass />
          <Weather weather={weather} preset={preset} onPreset={onPreset} sourceNote={sourceNote} />
        </div>
        <div className="atlas-hud__block atlas-hud__block--minimap">
          <Minimap atlas={atlas} store={store} onClick={onMinimapClick} />
          <div
            className="atlas-surveyed"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={surveyedCount}
            aria-label={`Explored ${surveyedCount} of ${total} projects`}
            title="Point at a settlement to lift the fog around it; the map remembers what you have explored."
          >
            <span style={{ width: `${(100 * surveyedCount) / Math.max(1, total)}%` }} />
          </div>
          <span className="atlas-explored" aria-hidden="true">
            explored {surveyedCount} of {total}
          </span>
        </div>
      </div>

      <div className={`atlas-rail${arrivingClass}`} role="toolbar" aria-label="Map tools">
        <RailButton label="Zoom in" onClick={() => onZoom(RAIL_ZOOM)}>
          <path d="M8 3.5v9M3.5 8h9" />
        </RailButton>
        <RailButton label="Zoom out" onClick={() => onZoom(1 / RAIL_ZOOM)}>
          <path d="M3.5 8h9" />
        </RailButton>
        <RailButton label="Show all islands" onClick={onFit}>
          <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
        </RailButton>
        <div className="atlas-rail__gap" />
        <RailButton label="Find a work" pressed={drawer === 'find'} onClick={() => toggle('find')}>
          <circle cx="7" cy="7" r="4" />
          <path d="M10 10l3.5 3.5" />
        </RailButton>
        <RailButton label="Legend" pressed={drawer === 'legend'} onClick={() => toggle('legend')}>
          <path d="M3 4.5h10M3 8h10M3 11.5h6" />
        </RailButton>
        <RailButton label="How to read this map" pressed={drawer === 'help'} onClick={() => toggle('help')}>
          <path d="M5.8 6.2a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.6" />
          <path d="M8 12.6v.1" strokeWidth="1.8" />
        </RailButton>
        <RailButton
          label={tourState.running ? 'End the tour' : `Tour the ${tourState.total} featured works`}
          pressed={tourState.running}
          onClick={() => {
            if (tourState.running) {
              tour.stop();
            } else {
              // The card the tour shows sits where a drawer would; one or the other.
              onDrawer(null);
              tour.start();
            }
          }}
        >
          {tourState.running ? <path d="M5.5 3.5v9M10.5 3.5v9" /> : <path d="M5.5 3.5v9l7-4.5z" />}
        </RailButton>
        <div className="atlas-rail__gap" />
        <SoundToggle audio={audio} />
        <RailButton label={exporting ? 'Drawing the image…' : 'Save as image'} onClick={onExport} disabled={exporting}>
          <path d="M8 2.5v8M5 7.5l3 3 3-3M3 13.5h10" />
        </RailButton>
        <div className="atlas-rail__gap" />
        <button type="button" className="atlas-rail__sheet" onClick={onListView} title="Switch to the plain list of works">
          List
        </button>
        <span className="atlas-rail__note" title="The map is an experiment; the list view is the stable face of the site.">
          {quality === 'lite' ? 'lite' : 'beta'}
        </span>
      </div>

      {drawer === 'legend' && (
        <Panel label="Legend" arriving={arriving} onClose={close}>
          <Legend atlas={atlas} onIslandClick={onIslandClick} />
          {ports.length > 1 && (
            <Chips
              label="Made in"
              hint="Where each work was made, Astana to Vienna; point at a city to light its works"
              goods={ports}
              interaction={interaction}
            />
          )}
          {goods.length > 0 && (
            <Chips
              label="Tools"
              hint="The software the works were made with; point at one to light the works that use it"
              goods={goods.slice(0, MAX_GOODS)}
              interaction={interaction}
            />
          )}
        </Panel>
      )}
      {drawer === 'find' && (
        <Panel label="Find a work" wide arriving={arriving} onClose={close}>
          <Find atlas={atlas} onGoTo={onGoTo} onClose={close} />
        </Panel>
      )}
      {drawer === 'help' && (
        <Panel label="How to read this map" wide arriving={arriving} onClose={close}>
          <Help atlas={atlas} surveyedCount={surveyedCount} tour={tour} onClose={close} />
        </Panel>
      )}

      {tourState.running && <TourBar tour={tour} index={tourState.index} total={tourState.total} slug={tourState.slug} />}
    </>
  );
}

/** A drawer beside the rail. */
function Panel({
  label,
  wide,
  arriving,
  onClose,
  children,
}: {
  label: string;
  wide?: boolean;
  arriving: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`atlas-hud atlas-drawer${wide ? ' atlas-drawer--wide' : ''}${arriving ? ' is-arriving' : ''}`}
      role="region"
      aria-label={label}
    >
      <button type="button" className="atlas-drawer__close" aria-label={`Close: ${label.toLowerCase()}`} onClick={onClose}>
        ×
      </button>
      {children}
    </div>
  );
}

function RailButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`atlas-rail__button${pressed ? ' is-on' : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      data-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

/** Ambient sound, off until asked (stage 7). */
function SoundToggle({ audio }: { audio: AmbientAudio }) {
  const on = useSyncExternalStore(audio.subscribe, audio.enabled);
  return (
    <RailButton label={on ? 'Sound on' : 'Sound off'} pressed={on} onClick={() => void audio.toggle()}>
      <path d="M2.5 6h2.5l3.5-2.8v9.6L5 10H2.5z" />
      {on ? (
        <path d="M11 5.5a3.2 3.2 0 0 1 0 5M12.6 3.6a5.8 5.8 0 0 1 0 8.8" />
      ) : (
        <path d="M10.5 6l3 4M13.5 6l-3 4" />
      )}
    </RailButton>
  );
}

/** The sizes with today's counts and what they stand for, then the islands with both their names; a click fits the island. */
function Legend({ atlas, onIslandClick }: { atlas: Atlas; onIslandClick: (island: Island) => void }) {
  const counts = useMemo(() => {
    const byTier = new Map<string, number>();
    for (const settlement of atlas.settlements) byTier.set(settlement.tier, (byTier.get(settlement.tier) ?? 0) + 1);
    return byTier;
  }, [atlas]);
  return (
    <>
      <span className="atlas-hud__eyebrow">Sizes</span>
      <div className="atlas-tiers" aria-label="Settlement sizes">
        {TIERS.map((tier) => (
          <div key={tier} className="atlas-tiers__row">
            <img src={SETTLEMENT_SPRITES[tier].src} alt="" />
            <span className="atlas-tiers__label">
              {TIER_LABEL[tier]}
              <small>{TIER_BLURB[tier]}</small>
            </span>
            <span className="atlas-tiers__count">{counts.get(tier) ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="atlas-legend__marks" aria-label="Marks">
        <span>
          <img src={CROWN_SRC} alt="" /> flagship work
        </span>
        <span>
          <img src={PENNANT_SRC} alt="" /> award
        </span>
      </div>
      <span className="atlas-hud__eyebrow">Islands</span>
      <div className="atlas-legend" aria-label="Islands">
        {atlas.islands.map((island) => (
          <button
            key={island.id}
            type="button"
            className="atlas-legend__row"
            title={`Zoom to ${island.name}`}
            onClick={() => onIslandClick(island)}
          >
            <span className="atlas-legend__name">{island.name}</span>
            <span className="atlas-legend__category">{describeCategory(island.category, island.projectCount)}</span>
            <span className="atlas-legend__native">
              {island.nativeName} · {island.gloss}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * One chip per set. Pointing (or focusing) lights its settlements through
 * the interaction store; a click pins the set so the lighting stays while
 * the visitor pans, until it is clicked again, Escape, or a tap on open sea.
 */
function Chips({
  label,
  hint,
  goods,
  interaction,
}: {
  label: string;
  hint: string;
  goods: readonly TradeGood[];
  interaction: InteractionStore;
}) {
  const pinned = useSyncExternalStore(interaction.subscribe, () => interaction.get().pinnedTool);
  const leave = (good: TradeGood): void => {
    if (interaction.get().tool === good) interaction.set({ tool: null });
  };
  return (
    <div className="atlas-goods" role="group" aria-label={label}>
      <span className="atlas-hud__eyebrow" title={hint}>
        {label}
      </span>
      <div className="atlas-goods__chips">
        {goods.map((good) => {
          const isPinned = pinned?.key === good.key;
          return (
            <button
              key={good.key}
              type="button"
              className={`atlas-good${isPinned ? ' is-pinned' : ''}`}
              aria-pressed={isPinned}
              title={`${good.slugs.length} ${good.slugs.length === 1 ? 'work' : 'works'}: ${good.label}`}
              onPointerEnter={() => interaction.set({ tool: good })}
              onPointerLeave={() => leave(good)}
              onFocus={() => interaction.set({ tool: good })}
              onBlur={() => leave(good)}
              onClick={() => interaction.set({ pinnedTool: isPinned ? null : good })}
            >
              {good.label}
              <span className="atlas-good__count">{good.slugs.length}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Every work on the map, grouped by island, filtered as the visitor types; a click flies there. */
function Find({ atlas, onGoTo, onClose }: { atlas: Atlas; onGoTo: (slug: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const bySlug = new Map(projects.map((project) => [project.slug, project]));
    const matches = (project: Project, settlement: Settlement): boolean =>
      needle === '' ||
      [project.title, project.tagline, project.category, project.madeIn ?? '', TIER_LABEL[settlement.tier], ...project.keywords, ...project.stack]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    return atlas.islands
      .map((island) => ({
        island,
        rows: atlas.settlements
          .filter((settlement) => settlement.islandId === island.id)
          .flatMap((settlement) => {
            const project = bySlug.get(settlement.slug);
            return project && matches(project, settlement) ? [{ settlement, project }] : [];
          })
          .sort(
            (a, b) =>
              (TIER_RANK.get(a.settlement.tier) ?? 9) - (TIER_RANK.get(b.settlement.tier) ?? 9) ||
              b.settlement.score - a.settlement.score,
          ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [atlas, query]);
  const shown = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="atlas-find">
      <span className="atlas-hud__eyebrow">Find a work</span>
      <input
        ref={inputRef}
        className="atlas-find__input"
        type="search"
        placeholder="Title, topic, tool or city"
        aria-label="Find a work by title, topic, tool or city"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (query) setQuery('');
            else onClose();
          }
        }}
      />
      <span className="atlas-find__count">
        {shown === atlas.settlements.length ? `${shown} works` : `${shown} of ${atlas.settlements.length} works`}
      </span>
      <div className="atlas-find__list">
        {groups.map(({ island, rows }) => (
          <div key={island.id} className="atlas-find__group">
            <span className="atlas-find__island">{island.name}</span>
            {rows.map(({ settlement, project }) => {
              const year = project.endDate ? Number(project.endDate.slice(0, 4)) || null : null;
              return (
                <button
                  key={settlement.slug}
                  type="button"
                  className="atlas-find__row"
                  title={`Go to ${project.title}`}
                  onClick={() => onGoTo(settlement.slug)}
                >
                  <img src={SETTLEMENT_SPRITES[settlement.tier].src} alt="" />
                  <span className="atlas-find__title">{project.title}</span>
                  <span className="atlas-find__meta">
                    {TIER_LABEL[settlement.tier]}
                    {year !== null ? ` · ${year}` : ''}
                    {project.madeIn ? ` · ${project.madeIn}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && <span className="atlas-find__empty">Nothing on the map matches "{query.trim()}".</span>}
      </div>
    </div>
  );
}

/** What the map is and how to read it; opens by itself on the first visit. */
function Help({ atlas, surveyedCount, tour, onClose }: { atlas: Atlas; surveyedCount: number; tour: Tour; onClose: () => void }) {
  const total = atlas.settlements.length;
  const first = atlas.islands.slice(0, 3);
  const kinds = first.map((island) => `${island.name} holds the ${describeCategory(island.category, island.projectCount).replace(/^\d+ /, '')}`);
  const sizes = TIERS.filter((tier) => tier !== 'ruin')
    .map((tier, index) => (index === 0 ? TIER_LABEL[tier] : TIER_LABEL[tier].toLowerCase()))
    .join(', ');
  const icon = {
    viewBox: '0 0 32 32',
    width: 30,
    height: 30,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
  return (
    <div className="atlas-help">
      <span className="atlas-hud__eyebrow">How to read this map</span>
      <p className="atlas-help__lead">My work, drawn as an archipelago.</p>
      <p className="atlas-help__text">
        Every island is one kind of work and every settlement is one project, drawn bigger the more there is to see. Click a settlement to
        open it.
      </p>
      <div className="atlas-help__rows">
        <HelpRow icon={<img src={islandSprite(first[0]?.id ?? 'jailau').src} alt="" />} title={`${atlas.islands.length} islands, ${atlas.islands.length} kinds of work.`}>
          {kinds.join(', ')}, and so on. Each also keeps a Kazakh name; the legend lists them.
        </HelpRow>
        <HelpRow icon={<img src={SETTLEMENT_SPRITES.fortress.src} alt="" />} title="Size is substance.">
          {sizes}. A crown marks the flagship work, a pennant an award; a ruin is work still in progress.
        </HelpRow>
        <HelpRow
          icon={
            <svg {...icon}>
              <path d="M4 22C10 10 22 10 28 6" strokeDasharray="3 3" />
              <circle cx="4" cy="22" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="28" cy="6" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          }
          title="Dashed lanes"
        >
          join works that share a subject or belong to a series. The boats sail them.
        </HelpRow>
        <HelpRow
          icon={
            <svg {...icon}>
              <path d="M9 23h13a5 5 0 0 0 .6-10 7.5 7.5 0 0 0-14.2 2A4 4 0 0 0 9 23z" />
              <path d="M11 26l-1 3M16 26l-1 3M21 26l-1 3" />
            </svg>
          }
          title="Live weather."
        >
          Sea, sky and season follow the real weather in Astana, where I was born. The timeline replays how the map grew.
        </HelpRow>
        <HelpRow
          icon={
            <svg {...icon}>
              <path d="M5 12h22M8 17h18M5 22h22" strokeOpacity="0.85" />
            </svg>
          }
          title="Fog lifts as you explore."
        >
          {surveyedCount} of {total} explored so far; the map remembers.
        </HelpRow>
      </div>
      <p className="atlas-help__controls">Drag to pan · scroll or pinch to zoom · click a settlement to open it · Tab walks the list</p>
      <div className="atlas-help__actions">
        {tour.get().total > 0 && (
          <button
            type="button"
            className="atlas-button atlas-button--primary"
            onClick={() => {
              onClose();
              tour.start();
            }}
          >
            Tour the {tour.get().total} featured works
          </button>
        )}
        <button type="button" className="atlas-button" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

function HelpRow({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="atlas-help__row">
      <span className="atlas-help__icon">{icon}</span>
      <span className="atlas-help__body">
        <strong>{title}</strong> {children}
      </span>
    </div>
  );
}

/** The tour's progress, bottom centre: which stop, its title, and the way forward, back and out. */
function TourBar({ tour, index, total, slug }: { tour: Tour; index: number; total: number; slug: string | null }) {
  const title = projects.find((project) => project.slug === slug)?.title ?? '';
  return (
    <div className="atlas-tour" role="status" aria-live="polite">
      <span className="atlas-hud__eyebrow">
        Tour · {index + 1} of {total}
      </span>
      <span className="atlas-tour__title">{title}</span>
      <span className="atlas-tour__buttons">
        <button type="button" aria-label="Previous stop" onClick={tour.prev} disabled={index === 0}>
          ‹
        </button>
        <button type="button" aria-label="Next stop" onClick={tour.next}>
          ›
        </button>
        <button type="button" aria-label="End the tour" onClick={tour.stop}>
          ×
        </button>
      </span>
      <span key={index} className="atlas-tour__progress" style={{ animationDuration: `${tour.dwellMs}ms` }} aria-hidden="true" />
    </div>
  );
}

/** Temperature, condition and wind in one line; the preview picker behind a small button. */
function Weather({
  weather,
  preset,
  onPreset,
  sourceNote,
}: {
  weather: WeatherState;
  preset: WeatherPreset | null;
  onPreset: (preset: WeatherPreset | null) => void;
  sourceNote: string;
}) {
  const [picking, setPicking] = useState(preset !== null);
  return (
    <div className="atlas-weather" title={`Live weather from Astana, where I was born. ${sourceNote}`}>
      <div className="atlas-weather__line">
        <WeatherIcon condition={weather.condition} isDay={weather.isDay} />
        <span className="atlas-weather__temperature">{formatTemperature(weather.temperature)}</span>
        <button
          type="button"
          className={`atlas-weather__toggle${preset !== null ? ' is-on' : ''}`}
          aria-label="Preview the map under another weather"
          aria-expanded={picking}
          title={preset !== null ? `Previewing ${PRESET_LABEL[preset]}` : 'Preview another weather'}
          onClick={() => setPicking((open) => !open)}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4S1.5 8 1.5 8z" />
            <circle cx="8" cy="8" r="1.8" />
          </svg>
        </button>
      </div>
      <span className="atlas-weather__wind">
        {CONDITION_LABEL[weather.condition]} · {compassPoint(weather.windDirection)} {Math.round(weather.windSpeed)} km/h · live from Astana
      </span>
      {picking && (
        <select
          className="atlas-weather__preview"
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
      )}
    </div>
  );
}

/**
 * The timeline (stage 6), top left. Collapsed it is one pill with the
 * month shown ("Today" most of the time); open, it is the slider with year
 * ticks, a project count and a lock. It stays open while a month other
 * than today is shown, so the map never eases back with its control out
 * of sight.
 */
function Timeline({ atlas, store, range }: { atlas: Atlas; store: ChronicleStore; range: { first: Month; last: Month } }) {
  const state = useSyncExternalStore(store.subscribe, store.get);
  const [open, setOpen] = useState(state.month !== null);
  const shown = open || state.month !== null || state.pinned;
  const month = state.month ?? range.last;
  const settled = useMemo(() => new Set(atlas.settlements.map((s) => s.islandId)).size, [atlas]);
  const years: number[] = [];
  for (let year = yearOf(range.first) + 1; year <= yearOf(range.last); year++) years.push(year);
  const span = Math.max(1, range.last - range.first);
  const at = (m: Month): string => `${(((m - range.first) / span) * 100).toFixed(2)}%`;
  const scrub = (on: boolean): void => store.set({ scrubbing: on });
  const label = state.month === null ? 'Today' : formatMonth(state.month);

  if (!shown) {
    return (
      <button
        type="button"
        className="atlas-hud atlas-hud--chronicle atlas-chronicle__pill"
        onClick={() => setOpen(true)}
        title="Replay how the map grew, month by month"
        aria-expanded={false}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.5 1.5" />
        </svg>
        <span className="atlas-hud__eyebrow">Timeline</span>
        <span className="atlas-chronicle__date">{label}</span>
      </button>
    );
  }

  return (
    <div className="atlas-hud atlas-hud--chronicle">
      <div className="atlas-chronicle__head">
        <span className="atlas-hud__eyebrow">Timeline</span>
        <span className="atlas-chronicle__date" aria-live="polite">
          {label}
        </span>
        <button
          type="button"
          className={`atlas-chronicle__lock${state.pinned ? ' is-on' : ''}`}
          aria-pressed={state.pinned}
          aria-label={state.pinned ? 'Release the timeline; the map eases back to today' : 'Hold the map at this month'}
          title={state.pinned ? 'Held at this month' : 'Hold this month'}
          onClick={() => store.set({ pinned: !state.pinned })}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.2" fill="currentColor" />
            <path d={state.pinned ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 6 0'} fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          type="button"
          className="atlas-chronicle__close"
          aria-label="Close the timeline"
          title={state.month === null ? 'Close' : 'Close; the map returns to today'}
          onClick={() => {
            store.set({ pinned: false, month: null, scrubbing: false });
            setOpen(false);
          }}
        >
          ×
        </button>
      </div>
      <div className="atlas-chronicle__track">
        <input
          type="range"
          min={range.first}
          max={range.last}
          step={1}
          value={month}
          aria-label="Timeline: the map on a month"
          aria-valuetext={label}
          onChange={(event) => {
            const value = Number(event.target.value);
            store.set({ month: value >= range.last ? null : value });
          }}
          onPointerDown={() => scrub(true)}
          onPointerUp={() => scrub(false)}
          onPointerCancel={() => scrub(false)}
          onKeyDown={() => scrub(true)}
          onKeyUp={() => scrub(false)}
          onBlur={() => scrub(false)}
        />
        <div className="atlas-chronicle__ticks" aria-hidden="true">
          {years.map((year) => (
            <span key={year} style={{ left: at(year * 12 + 1) }}>
              {year}
            </span>
          ))}
        </div>
      </div>
      <span className="atlas-chronicle__count">
        {atlas.settlements.length} projects on {settled} of {atlas.islands.length} islands
      </span>
    </div>
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
          >
            <title>
              {island.name} · {island.category}
            </title>
          </image>
        );
      })}
      <rect ref={rectRef} className="atlas-minimap__viewport" x="0" y="0" width="0" height="0" />
    </svg>
  );
}

/** The real lunar phase, drawn as the lit part of a disc. */
function Moon({ arriving }: { arriving: boolean }) {
  const { phase, illumination, waxing } = moonPhase(new Date());
  const r = 14;
  // The terminator is an ellipse whose x radius runs from -r (new) through 0 (quarter) to r (full).
  const terminator = r * Math.cos(2 * Math.PI * phase);
  const litSide = waxing ? 1 : -1;
  const outer = `M0,${-r} A${r},${r} 0 0,${waxing ? 1 : 0} 0,${r}`;
  const inner = `A${Math.abs(terminator)},${r} 0 0,${(terminator * litSide < 0) === waxing ? 0 : 1} 0,${-r}`;
  const label = `${Math.round(illumination * 100)}% lit, ${waxing ? 'waxing' : 'waning'}`;
  return (
    <svg
      className={`atlas-moon${arriving ? ' is-arriving' : ''}`}
      viewBox="-18 -18 36 36"
      role="img"
      aria-label={`Moon, ${label}`}
    >
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
      <g fill="#efe6d0" fontFamily="var(--atlas-serif)" fontSize="9" textAnchor="middle">
        <text y="-31">N</text>
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
