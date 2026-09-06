import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useNavigationType } from 'react-router-dom';
import { projects } from '../data/projects';
import { usePageMeta } from '../hooks/usePageMeta';
import { LifeSim, planAmbient } from './ambient.ts';
import { loadImages, textureSources } from './assets.ts';
import AtlasFocus from './AtlasFocus';
import AtlasHud from './AtlasHud';
import AtlasLabels from './AtlasLabels';
import AtlasLanes from './AtlasLanes';
import {
  clampCamera,
  createCameraAnimator,
  createViewStore,
  fitBounds,
  islandBounds,
  prefersReducedMotion,
  readSavedCamera,
  saveCamera,
  worldToScreen,
  type Camera,
  type Point,
} from './camera.ts';
import {
  atlasAt,
  chronicleAtlas,
  chronicleRange,
  createChronicleStore,
  monthOfString,
} from './chronicle.ts';
import { TIER_LABEL } from './config.ts';
import { attachCameraControls } from './controls.ts';
import { markSurveyed, useSurveyed } from './fog.ts';
import { AtlasRenderer, type FrameState, type SpriteState } from './gl/renderer.ts';
import { buildAtlas } from './index.ts';
import { createInteractionStore, hitTest } from './interaction.ts';
import { sheetOrder } from './order.ts';
import { tradeGoods } from './tools.ts';
import type { Island } from './types.ts';
import { defaultViewMode, setViewMode } from './viewMode.ts';
import { WeatherSim, initialSnowCover, targetLook } from './weather/sim.ts';
import { PRESET_LABEL, presetWeather, useWeather, type WeatherPreset, type WeatherState } from './weather/weather.ts';
import './atlas.css';

/*
 * The atlas at `/`: one WebGL canvas for sea, islands, settlements, the
 * ambient life, the highlight dim and the fog, and DOM layers above it for
 * lanes, labels, the rings and card, and the HUD. This component owns the
 * single requestAnimationFrame loop; it stops while the tab is hidden and
 * on unmount, which is what happens when the sheet view takes over.
 *
 * Opening a settlement zooms toward it, then routes to its sheet inside a
 * view transition so the card's cover morphs into the detail hero, the
 * same mechanism the works grid uses. The camera is saved first, and Back
 * restores it exactly.
 *
 * A first visit arrives from above (stage 5): the camera starts far out
 * behind a veil of cloud and settles on the fitted archipelago while the
 * HUD fades in. Once is enough; a flag in localStorage remembers, and the
 * flight is skipped under reduced motion, on Back, and when the sheet is
 * the default view for this device.
 */

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

/** Above 2 the sea shader costs more than it shows. */
const MAX_DPR = 2;
/** Fog clears this many footprints around a surveyed settlement. */
const REVEAL_FOOTPRINTS = 5;
/** Settlements within this many pixels of the edge get panned into view on keyboard focus. */
const FOCUS_MARGIN = 80;
/** The first-visit flight: how long, how far out it starts, and where the HUD begins to fade in. */
const FLY_MS = 3600;
const FLY_START_ZOOM = 0.3;
const FLY_HUD_AT = 0.62;
const FLOWN_KEY = 'atlas:flown';
/** A settlement's sprite cross-fades between tiers over this long. */
const CROSSFADE_S = 0.45;

interface Flight {
  from: Camera;
  to: Camera;
  start: number;
  /** Dev only: freeze part-way so a headless render can capture the arrival. */
  hold: boolean;
}

function hasFlown(): boolean {
  try {
    return localStorage.getItem(FLOWN_KEY) === '1';
  } catch {
    return true;
  }
}

function rememberFlown(): void {
  try {
    localStorage.setItem(FLOWN_KEY, '1');
  } catch {
    // Private mode: the visitor gets the flight again next time; no harm.
  }
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function AtlasView() {
  usePageMeta();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const atlas = useMemo(() => buildAtlas(projects), []);
  const store = useMemo(
    () => createViewStore({ camera: { x: 0.5, y: 0.5, zoom: 800 }, viewport: { width: 1, height: 1 } }),
    [],
  );
  const interaction = useMemo(() => createInteractionStore(), []);
  const animator = useMemo(() => createCameraAnimator(store, atlas.bounds), [atlas.bounds, store]);
  const bySlug = useMemo(() => new Map(atlas.settlements.map((s) => [s.slug, s])), [atlas]);
  const sheet = useMemo(() => sheetOrder(projects).filter((p) => bySlug.has(p.slug)), [bySlug]);
  // Trade goods worth a chip: tags shared by at least two settlements on the map.
  const goods = useMemo(
    () =>
      tradeGoods(projects)
        .map((good) => ({ ...good, slugs: good.slugs.filter((slug) => bySlug.has(slug)) }))
        .filter((good) => good.slugs.length >= 2),
    [bySlug],
  );
  // The chronicle (stage 6): a scrubbed month, the atlas as it stood then, and what the DOM layers show.
  const chronicle = useMemo(() => createChronicleStore(), []);
  const range = useMemo(() => chronicleRange(projects, atlas), [atlas]);
  const month = useSyncExternalStore(chronicle.subscribe, () => chronicle.get().month);
  const frame = useMemo(() => (month === null ? null : atlasAt(atlas, projects, month)), [atlas, month]);
  const viewAtlas = useMemo(() => (frame ? chronicleAtlas(atlas, frame) : atlas), [atlas, frame]);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const viewAtlasRef = useRef(viewAtlas);
  viewAtlasRef.current = viewAtlas;
  const surveyed = useSurveyed();
  const surveyedRef = useRef(surveyed);
  surveyedRef.current = surveyed;
  const surveyedCount = useMemo(
    () => atlas.settlements.filter((s) => surveyed.has(s.slug)).length,
    [atlas, surveyed],
  );
  const { weather: liveWeather, error: weatherError } = useWeather();
  const [preset, setPreset] = useState<WeatherPreset | null>(null);
  // The state the map shows: a preview preset if one is chosen, else the live forecast.
  const shownWeather: WeatherState = useMemo(
    () => (preset ? presetWeather(preset) : liveWeather),
    [liveWeather, preset],
  );
  const weatherRef = useRef(shownWeather);
  weatherRef.current = shownWeather;
  const simRef = useRef<WeatherSim | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [arriving, setArriving] = useState(false);
  const opening = useRef(false);

  /*
   * Dev only: lets the console and the browser tooling read the layout and
   * camera, and a few URL parameters open the map in a state a headless
   * render can capture: `?atlas-hover=<slug>` with that settlement active,
   * `?atlas-tool=<key>` with that trade good pinned, `?atlas-weather=<preset>`
   * under that weather, `?atlas-flyin[=hold]` mid-arrival, `?atlas-camera=x,y,zoom` at a camera,
   * `?atlas-date=YYYY-MM` with the chronicle held at that month. All of it
   * disappears from the production build with the DEV branch.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debugWindow = window as unknown as { __atlas?: unknown };
    debugWindow.__atlas = { atlas, store, interaction };
    const params = new URLSearchParams(window.location.search);
    const hover = params.get('atlas-hover');
    if (hover && status.kind === 'ready') interaction.set({ hovered: hover });
    const tool = params.get('atlas-tool');
    const good = tool ? goods.find((g) => g.key === tool) : undefined;
    if (good && status.kind === 'ready') interaction.set({ pinnedTool: good });
    const weatherParam = params.get('atlas-weather');
    if (weatherParam && weatherParam in PRESET_LABEL) setPreset(weatherParam as WeatherPreset);
    const dateParam = params.get('atlas-date');
    const dateMonth = dateParam ? monthOfString(dateParam) : null;
    if (dateMonth !== null) chronicle.set({ month: Math.max(range.first, Math.min(range.last, dateMonth)), pinned: true });
    return () => {
      delete debugWindow.__atlas;
    };
  }, [atlas, chronicle, goods, interaction, range, status.kind, store]);

  /*
   * Warm the detail route while the visitor is still pointing at a
   * settlement, as WorkCard does: the same specifier as App.tsx's lazy()
   * import, so the router awaits the very module this resolves.
   */
  const warmDetail = useMemo(() => {
    let promise: Promise<boolean> | null = null;
    return (): Promise<boolean> => {
      promise ??= import('../pages/WorkDetailPage')
        .then(() => true)
        .catch(() => false);
      return promise;
    };
  }, []);

  const openProject = useCallback(
    async (slug: string) => {
      const settlement = bySlug.get(slug);
      if (!settlement || opening.current) return;
      opening.current = true;
      markSurveyed(slug);
      const { camera, viewport } = store.get();
      saveCamera(camera);
      const warm = warmDetail();
      const fit = fitBounds(atlas.bounds, viewport);
      const target = clampCamera(
        { x: settlement.x, y: settlement.y, zoom: Math.max(camera.zoom * 2.2, fit.zoom * 3.2) },
        viewport,
        atlas.bounds,
      );
      await animator.to(target, 480);
      const ready = await warm;
      const go = (): void => navigate(`/works/${slug}`);
      if (ready && typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
        const transition = document.startViewTransition(() => {
          flushSync(go);
        });
        transition.ready.catch(() => {});
      } else {
        go();
      }
    },
    [animator, atlas.bounds, bySlug, navigate, store, warmDetail],
  );

  const clearInteraction = useCallback(() => {
    interaction.set({ hovered: null, selected: null, focused: null, tool: null, pinnedTool: null });
  }, [interaction]);

  const hoverAt = useCallback(
    (point: Point | null) => {
      const { camera, viewport } = store.get();
      const slug = point ? hitTest(viewAtlasRef.current, camera, viewport, point.x, point.y) : null;
      interaction.set({ hovered: slug });
      if (slug) {
        markSurveyed(slug);
        void warmDetail();
      }
    },
    [interaction, store, warmDetail],
  );

  const tapAt = useCallback(
    (point: Point, pointerType: string) => {
      const { camera, viewport } = store.get();
      const slug = hitTest(viewAtlasRef.current, camera, viewport, point.x, point.y);
      if (pointerType === 'touch') {
        // First tap selects and shows the card; a second tap on the same settlement opens it.
        if (slug && interaction.get().selected === slug) {
          void openProject(slug);
          return;
        }
        interaction.set({ selected: slug, hovered: null });
        if (slug) {
          markSurveyed(slug);
          void warmDetail();
        }
        return;
      }
      if (slug) void openProject(slug);
      else interaction.set({ selected: null, pinnedTool: null });
    },
    [interaction, openProject, store, warmDetail],
  );

  const focusSettlement = useCallback(
    (slug: string) => {
      interaction.set({ focused: slug });
      const settlement = bySlug.get(slug);
      if (!settlement) return;
      markSurveyed(slug);
      void warmDetail();
      const { camera, viewport } = store.get();
      const point = worldToScreen(camera, viewport, settlement.x, settlement.y);
      const offscreen =
        point.x < FOCUS_MARGIN ||
        point.y < FOCUS_MARGIN ||
        point.x > viewport.width - FOCUS_MARGIN ||
        point.y > viewport.height - FOCUS_MARGIN;
      if (offscreen) void animator.to({ x: settlement.x, y: settlement.y, zoom: camera.zoom }, 320);
    },
    [animator, bySlug, interaction, store, warmDetail],
  );

  const fitIsland = useCallback(
    (island: Island) => {
      void animator.to(fitBounds(islandBounds(island), store.get().viewport, 0.1), 520);
    },
    [animator, store],
  );

  const flyTo = useCallback(
    (point: Point) => {
      void animator.to({ x: point.x, y: point.y, zoom: store.get().camera.zoom }, 400);
    },
    [animator, store],
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: AtlasRenderer | null = null;
    let detachControls: (() => void) | null = null;
    let frame = 0;
    let cancelled = false;
    let sized = false;
    let lastTime = 0;
    const params = new URLSearchParams(window.location.search);
    // Dev only: a preset asked for by URL snaps into place, so a headless render shows the settled look.
    const snapWeather = import.meta.env.DEV && params.has('atlas-weather');
    const reducedMotion = prefersReducedMotion();
    const instant = reducedMotion || snapWeather;
    const flyParam = import.meta.env.DEV ? params.get('atlas-flyin') : null;
    const wantsFlight =
      flyParam !== null ||
      (!reducedMotion &&
        navigationType !== 'POP' &&
        defaultViewMode() === 'map' &&
        !snapWeather &&
        !params.has('atlas-hover') &&
        !params.has('atlas-tool') &&
        !params.has('atlas-camera') &&
        !params.has('atlas-date') &&
        !hasFlown());
    let flight: Flight | null = null;
    const dpr = (): number => Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const applyViewport = (): void => {
      const rect = container.getBoundingClientRect();
      // A container measured mid-layout can report 0×0; the observer calls again once it has a size.
      if (rect.width < 2 || rect.height < 2) return;
      const viewport = { width: rect.width, height: rect.height };
      let camera = store.get().camera;
      if (!sized) {
        // Back lands on the view the visitor left; any other arrival fits the archipelago.
        const saved = navigationType === 'POP' ? readSavedCamera() : null;
        const fit = fitBounds(atlas.bounds, viewport);
        camera = saved ?? fit;
        // Dev only: `?atlas-camera=x,y,zoom` opens at that world point, zoom as a multiple of the fit.
        const cameraParam = import.meta.env.DEV ? params.get('atlas-camera') : null;
        if (cameraParam) {
          const [x, y, zoom] = cameraParam.split(',').map(Number);
          if ([x, y, zoom].every(Number.isFinite)) camera = { x, y, zoom: fit.zoom * zoom };
        }
        if (wantsFlight) {
          // Start high above and a little to the south-east, the way a chart is approached from the sea.
          const width = atlas.bounds.maxX - atlas.bounds.minX;
          flight = {
            from: { x: fit.x + width * 0.08, y: fit.y + width * 0.05, zoom: fit.zoom * FLY_START_ZOOM },
            to: fit,
            start: 0,
            hold: flyParam === 'hold',
          };
          camera = flight.from;
          frameState.veil = 1;
          setArriving(true);
          rememberFlown();
        }
        sized = true;
      }
      // Mid-flight the camera sits outside the clamp on purpose.
      store.set({ viewport, camera: flight ? camera : clampCamera(camera, viewport, atlas.bounds) });
      renderer?.resize(viewport.width, viewport.height, dpr());
    };

    const endFlight = (): void => {
      if (!flight) return;
      const { viewport } = store.get();
      store.set({ camera: clampCamera(flight.to, viewport, atlas.bounds) });
      flight = null;
      frameState.veil = 0;
      setArriving(false);
    };
    // Any gesture during the arrival lands the camera at once.
    const onGesture = (): void => endFlight();

    // Fog reveal progress per settlement, 0 to 1, eased toward the surveyed set.
    const progress = new Float32Array(atlas.settlements.length);
    atlas.settlements.forEach((s, i) => {
      progress[i] = surveyedRef.current.has(s.slug) ? 1 : 0;
    });
    const reveals = new Float32Array((atlas.settlements.length + 1) * 3);
    const sim = simRef.current ?? new WeatherSim(targetLook(weatherRef.current, Date.now()), initialSnowCover(weatherRef.current));
    simRef.current = sim;
    const plan = planAmbient(atlas);
    const life = new LifeSim(atlas, plan);
    if (import.meta.env.DEV) {
      const debugWindow = window as unknown as { __atlas?: { sim?: WeatherSim; life?: LifeSim; plan?: unknown } };
      if (debugWindow.__atlas) {
        debugWindow.__atlas.sim = sim;
        debugWindow.__atlas.life = life;
        debugWindow.__atlas.plan = plan;
      }
    }
    let weatherTime = 0;
    // Chronicle sprite states, kept only while a date is shown or the map is settling back to today.
    const sprites = new Map<string, SpriteState>();
    const today = range.last;
    let back = Number.NaN;
    const frameState: FrameState = {
      chronicle: null,
      highlights: [],
      highlightStrength: 0,
      reveals,
      revealCount: 0,
      fog: 1,
      weather: sim.look,
      weatherTime: 0,
      driftX: 0,
      driftY: 0,
      veil: 0,
      life,
      plan,
    };
    // Dev only: a running average of the frame time, readable from window.__atlas.frameMs.
    let frameMs = 0;

    const tick = (now: number): void => {
      frame = 0;
      if (!renderer || document.hidden) return;
      const dt = lastTime === 0 ? 1 / 60 : Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // The arrival: zoom eased in log space so the descent reads evenly, the veil thinning ahead of it.
      if (flight) {
        if (flight.start === 0) flight.start = now;
        const t = flight.hold ? 0.38 : Math.min(1, (now - flight.start) / FLY_MS);
        const e = easeInOutCubic(t);
        const { from, to } = flight;
        store.set({
          camera: {
            x: from.x + (to.x - from.x) * e,
            y: from.y + (to.y - from.y) * e,
            zoom: from.zoom * Math.pow(to.zoom / from.zoom, e),
          },
        });
        frameState.veil = Math.max(0, 1 - e * 1.35);
        if (t >= FLY_HUD_AT) setArriving(false);
        if (t >= 1) endFlight();
      }

      // Chronicle: released and not held, the month eases back to today; then every sprite eases toward its state.
      const scrub = chronicle.get();
      if (scrub.month !== null && !scrub.scrubbing && !scrub.pinned) {
        if (reducedMotion) {
          chronicle.set({ month: null });
        } else {
          if (Number.isNaN(back)) back = scrub.month;
          back += (today - back) * Math.min(1, dt * 2.4);
          chronicle.set({ month: today - back < 0.5 ? null : Math.round(back) });
        }
      } else {
        back = Number.NaN;
      }
      const chronicleFrame = frameRef.current;
      if (chronicleFrame !== null || sprites.size > 0) {
        let settled = chronicleFrame === null;
        for (const settlement of atlas.settlements) {
          const target = chronicleFrame ? chronicleFrame.states.get(settlement.slug) : { tier: settlement.tier };
          let state = sprites.get(settlement.slug);
          if (!state) {
            state = { tier: settlement.tier, prevTier: null, blend: 1, presence: 1 };
            sprites.set(settlement.slug, state);
          }
          if (target && target.tier !== state.tier) {
            state.prevTier = instant ? null : state.tier;
            state.tier = target.tier;
            state.blend = instant ? 1 : 0;
          }
          if (state.blend < 1) state.blend = Math.min(1, state.blend + dt / CROSSFADE_S);
          const goal = target ? 1 : 0;
          state.presence = instant ? goal : state.presence + (goal - state.presence) * Math.min(1, dt * 5);
          if (Math.abs(goal - state.presence) < 0.005) state.presence = goal;
          if (state.presence !== 1 || state.blend < 1 || state.tier !== settlement.tier) settled = false;
        }
        if (settled) sprites.clear();
        frameState.chronicle = sprites.size > 0 ? sprites : null;
      }

      // Highlights keep their last set while the dim fades out, so the redraw does not pop.
      const highlights = interaction.highlights();
      if (highlights.length > 0) frameState.highlights = highlights;
      const goal = highlights.length > 0 ? 1 : 0;
      frameState.highlightStrength = instant
        ? goal
        : frameState.highlightStrength + (goal - frameState.highlightStrength) * Math.min(1, dt * 9);
      if (goal === 0 && frameState.highlightStrength < 0.01) {
        frameState.highlightStrength = 0;
        frameState.highlights = [];
      }

      let count = 0;
      atlas.settlements.forEach((s, i) => {
        const target = surveyedRef.current.has(s.slug) ? 1 : 0;
        progress[i] = instant ? target : progress[i] + (target - progress[i]) * Math.min(1, dt * 2.2);
        if (progress[i] > 0.01) {
          const eased = 1 - Math.pow(1 - progress[i], 3);
          reveals[count * 3] = s.x;
          reveals[count * 3 + 1] = s.y;
          reveals[count * 3 + 2] = s.footprint * REVEAL_FOOTPRINTS * eased;
          count += 1;
        }
      });
      frameState.revealCount = count;

      // Weather: ease toward the current target, keep the cloud field drifting with the wind.
      const target = targetLook(weatherRef.current, Date.now());
      if (snapWeather && sim.look.snow !== target.snow) sim.look.snowCover = initialSnowCover(weatherRef.current);
      sim.update(dt, target, instant);
      if (!instant) {
        weatherTime += dt;
        const drift = AtlasRenderer.drift(sim.look, dt);
        frameState.driftX += drift.x;
        frameState.driftY += drift.y;
      }
      frameState.weatherTime = weatherTime;
      // Ambient life holds still under reduced motion: boats, gulls and smoke stay where they were placed.
      if (!reducedMotion) life.update(dt, sim.look);

      const started = performance.now();
      renderer.render(store.get().camera, dpr(), now / 1000, frameState);
      frameMs += (performance.now() - started - frameMs) * 0.05;
      if (import.meta.env.DEV) {
        const debugWindow = window as unknown as { __atlas?: { frameMs?: number } };
        if (debugWindow.__atlas) debugWindow.__atlas.frameMs = frameMs;
      }
      frame = requestAnimationFrame(tick);
    };
    const start = (): void => {
      if (frame === 0 && renderer && !document.hidden) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
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
        applyViewport();
        detachControls = attachCameraControls(container, store, animator, {
          onHoverMove: hoverAt,
          onTap: tapAt,
          onEscape: clearInteraction,
        });
        setStatus({ kind: 'ready' });
        start();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      });

    const observer = new ResizeObserver(() => applyViewport());
    observer.observe(container);
    document.addEventListener('visibilitychange', onVisibility);
    container.addEventListener('pointerdown', onGesture, true);
    container.addEventListener('wheel', onGesture, { capture: true, passive: true });
    container.addEventListener('keydown', onGesture, true);

    return () => {
      cancelled = true;
      stop();
      animator.cancel();
      detachControls?.();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      container.removeEventListener('pointerdown', onGesture, true);
      container.removeEventListener('wheel', onGesture, true);
      container.removeEventListener('keydown', onGesture, true);
      renderer?.dispose();
      renderer = null;
    };
  }, [animator, atlas, chronicle, clearInteraction, hoverAt, interaction, navigationType, range, store, tapAt]);

  return (
    <div
      ref={containerRef}
      className={`atlas-view${arriving ? ' is-arriving' : ''}`}
      data-atlas-status={status.kind}
      tabIndex={0}
      aria-label="Atlas of works. Drag to pan, scroll to zoom, arrow keys to move; Tab reaches the settlements."
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      {status.kind === 'ready' && (
        <>
          <AtlasLanes atlas={viewAtlas} store={store} interaction={interaction} />
          <AtlasLabels
            atlas={viewAtlas}
            store={store}
            interaction={interaction}
            onOpen={(slug) => void openProject(slug)}
            onIslandClick={fitIsland}
          />
          <AtlasFocus atlas={viewAtlas} store={store} interaction={interaction} onOpen={(slug) => void openProject(slug)} />
          <AtlasHud
            atlas={viewAtlas}
            store={store}
            interaction={interaction}
            chronicle={chronicle}
            range={range}
            goods={goods}
            arriving={arriving}
            surveyedCount={surveyedCount}
            weather={shownWeather}
            weatherError={weatherError}
            preset={preset}
            onPreset={setPreset}
            onSheetView={() => setViewMode('sheet')}
            onMinimapClick={flyTo}
          />
        </>
      )}
      <nav className="atlas-sr-list" aria-label="Settlements in sheet order">
        <ul>
          {sheet.map((project) => {
            const settlement = bySlug.get(project.slug);
            if (!settlement) return null;
            return (
              <li key={project.slug}>
                <a
                  href={`/works/${project.slug}`}
                  onFocus={() => focusSettlement(project.slug)}
                  onBlur={() => {
                    if (interaction.get().focused === project.slug) interaction.set({ focused: null });
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    void openProject(project.slug);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      clearInteraction();
                      event.currentTarget.blur();
                    }
                  }}
                >
                  {project.title}, {TIER_LABEL[settlement.tier].toLowerCase()}, {project.category}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
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
