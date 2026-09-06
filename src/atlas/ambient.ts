import { ATLAS_SEED } from './config.ts';
import { curveHeading, curvePoint, laneCurve, type LaneCurve } from './lanes.ts';
import { isLand, paintingHalfWidth } from './layout.ts';
import { hashString, mulberry32, type Rng } from './prng.ts';
import type { Atlas, Island, Settlement } from './types.ts';
import type { WeatherLook } from './weather/sim.ts';

/*
 * Ambient life (stage 5). Two halves:
 *
 *   planAmbient  where the fixed things stand: one lighthouse and one
 *                harbour per island, a windmill on the larger islands.
 *                Seeded from the atlas seed and the island id, and kept off
 *                the settlements, so it is as deterministic as the layout.
 *   LifeSim      what moves each frame: chimney smoke, gulls circling the
 *                harbours, windmill sails turning with the real wind, the
 *                lighthouse beam at night, and one or two boats sailing the
 *                sea lanes, easing at ports and running for harbour when
 *                the weather turns.
 */

export interface Landmark {
  islandId: string;
  x: number;
  y: number;
}

export interface AmbientPlan {
  lighthouses: Landmark[];
  harbours: Landmark[];
  windmills: Landmark[];
}

const TAU = Math.PI * 2;

/** The last land point walking outward from a start along a bearing, or null if none. */
function coastPoint(island: Island, fromX: number, fromY: number, bearing: number): { x: number; y: number } | null {
  const reach = paintingHalfWidth(island) * 1.5;
  const step = 0.003;
  let found: { x: number; y: number } | null = null;
  for (let d = 0; d < reach; d += step) {
    const x = fromX + Math.cos(bearing) * d;
    const y = fromY + Math.sin(bearing) * d;
    if (isLand(island, x, y)) found = { x, y };
    else if (found) break;
  }
  return found;
}

export function planAmbient(atlas: Atlas): AmbientPlan {
  const plan: AmbientPlan = { lighthouses: [], harbours: [], windmills: [] };
  for (const island of atlas.islands) {
    const rng: Rng = mulberry32(ATLAS_SEED ^ hashString(`${island.id}:ambient`));
    const own = atlas.settlements.filter((s) => s.islandId === island.id);
    const clearOf = (x: number, y: number, margin: number): boolean =>
      own.every((s) => Math.hypot(s.x - x, s.y - y) > s.footprint + margin);

    // Lighthouse: a coast point on a seeded bearing, away from the settlements.
    const start = rng() * TAU;
    for (let i = 0; i < 16; i++) {
      const point = coastPoint(island, island.x, island.y, start + (i * TAU) / 16);
      if (point && clearOf(point.x, point.y, 0.02)) {
        plan.lighthouses.push({ islandId: island.id, ...point });
        break;
      }
    }

    // Harbour: the nearest coast to the island's seat, pushed a little out to sea.
    const seat = own.find((s) => s.slug === island.seat) ?? { x: island.x, y: island.y };
    let harbour: { x: number; y: number; bearing: number } | null = null;
    let best = Infinity;
    for (let i = 0; i < 24; i++) {
      const bearing = (i * TAU) / 24;
      const point = coastPoint(island, seat.x, seat.y, bearing);
      if (!point) continue;
      const distance = Math.hypot(point.x - seat.x, point.y - seat.y);
      if (distance < best) {
        best = distance;
        harbour = { ...point, bearing };
      }
    }
    if (harbour) {
      plan.harbours.push({
        islandId: island.id,
        x: harbour.x + Math.cos(harbour.bearing) * 0.014,
        y: harbour.y + Math.sin(harbour.bearing) * 0.014,
      });
    }

    // Windmill: on islands with three or more settlements, a free patch of land part way out.
    if (own.length >= 3) {
      const windStart = rng() * TAU;
      outer: for (const fraction of [0.5, 0.62, 0.38]) {
        for (let i = 0; i < 24; i++) {
          const bearing = windStart + (i * TAU) / 24;
          const x = island.x + Math.cos(bearing) * island.radius * fraction;
          const y = island.y + Math.sin(bearing) * island.radius * fraction;
          if (isLand(island, x, y) && isLand(island, x + 0.01, y) && isLand(island, x - 0.01, y) && clearOf(x, y, 0.024)) {
            plan.windmills.push({ islandId: island.id, x, y });
            break outer;
          }
        }
      }
    }
  }
  return plan;
}

/* ---- Simulation ---------------------------------------------------------- */

export interface SmokePuff {
  x: number;
  y: number;
  age: number;
  life: number;
}

export interface Gull {
  cx: number;
  cy: number;
  radius: number;
  angle: number;
  /** Radians per second; negative circles the other way. */
  speed: number;
  phase: number;
}

export type BoatState = 'sailing' | 'docked' | 'anchored';

export interface Boat {
  laneIndex: number;
  /** Progress along the lane, 0 at `from` to 1 at `to`. */
  t: number;
  forward: boolean;
  state: BoatState;
  /** Seconds left in port. */
  wait: number;
  x: number;
  y: number;
  heading: number;
  /** Recent positions, oldest first, for the wake. */
  wake: { x: number; y: number }[];
  wakeTimer: number;
}

export interface SmokeSource {
  slug: string;
  x: number;
  y: number;
  /** Thinner at higher tiers. */
  alpha: number;
  interval: number;
  timer: number;
  puffs: SmokePuff[];
}

/** World units per second on open water. */
const BOAT_SPEED = 0.016;
/** Fraction of a lane over which a boat eases in and out of port. */
const BOAT_EASE = 0.15;
const BOAT_COUNT = 2;
const SMOKE_LIFE = 4.5;
const SMOKE_PUFFS = 3;
const GULLS_PER_HARBOUR = 2;

const SMOKE_ALPHA: Record<string, number> = {
  fortress: 0.16,
  'walled-town': 0.2,
  'market-town': 0.26,
  hamlet: 0.32,
};

/** Where a lane crosses water: from the last land sample leaving one island to the first arriving at the other. */
function waterSpan(curve: LaneCurve, islands: readonly Island[]): { min: number; max: number } {
  const STEPS = 64;
  const onLand = (t: number): boolean => {
    const point = curvePoint(curve, t);
    return islands.some((island) => isLand(island, point.x, point.y));
  };
  let min = 0;
  let max = 1;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    if (onLand(t)) min = t;
    else break;
  }
  for (let i = STEPS; i >= 0; i--) {
    const t = i / STEPS;
    if (onLand(t)) max = t;
    else break;
  }
  // A lane whose water stretch is too short to sail keeps its whole length.
  if (max - min < 0.15) return { min: 0.15, max: 0.85 };
  // Stand a little off the beach.
  const margin = Math.min(0.04, (max - min) * 0.1);
  return { min: min + margin, max: max - margin };
}

export class LifeSim {
  readonly smoke: SmokeSource[] = [];
  readonly gulls: Gull[] = [];
  readonly boats: Boat[] = [];
  readonly curves: LaneCurve[] = [];
  readonly laneEnds: { from: Settlement; to: Settlement }[] = [];
  /** The stretch of each curve, in t, that lies over water: boats dock at its ends, just off the beach. */
  readonly spans: { min: number; max: number }[] = [];
  sailAngle = 0;
  beamAngle = 0;
  private readonly rng: Rng;
  private readonly bySlug: Map<string, Settlement>;

  constructor(atlas: Atlas, plan: AmbientPlan) {
    this.rng = mulberry32(ATLAS_SEED ^ hashString('life'));
    this.bySlug = new Map(atlas.settlements.map((s) => [s.slug, s]));

    for (const settlement of atlas.settlements) {
      if (settlement.tier === 'ruin') continue;
      this.smoke.push({
        slug: settlement.slug,
        x: settlement.x,
        y: settlement.y - settlement.footprint * 1.5,
        alpha: SMOKE_ALPHA[settlement.tier] ?? 0.25,
        interval: SMOKE_LIFE / SMOKE_PUFFS,
        timer: this.rng() * SMOKE_LIFE,
        puffs: [],
      });
    }

    for (const harbour of plan.harbours) {
      for (let i = 0; i < GULLS_PER_HARBOUR; i++) {
        this.gulls.push({
          cx: harbour.x,
          cy: harbour.y,
          radius: 0.014 + this.rng() * 0.012,
          angle: this.rng() * TAU,
          speed: (0.45 + this.rng() * 0.4) * (this.rng() < 0.5 ? 1 : -1),
          phase: this.rng() * TAU,
        });
      }
    }

    // Only lanes across water carry boats.
    atlas.lanes.forEach((lane) => {
      const from = this.bySlug.get(lane.from);
      const to = this.bySlug.get(lane.to);
      if (!lane.crossing || !from || !to) return;
      const curve = laneCurve(lane, from, to);
      this.curves.push(curve);
      this.laneEnds.push({ from, to });
      this.spans.push(waterSpan(curve, atlas.islands));
    });
    for (let i = 0; i < BOAT_COUNT && this.curves.length > 0; i++) {
      const laneIndex = Math.floor(this.rng() * this.curves.length);
      const span = this.spans[laneIndex];
      const boat: Boat = {
        laneIndex,
        t: span.min + (0.2 + this.rng() * 0.6) * (span.max - span.min),
        forward: this.rng() < 0.5,
        state: 'sailing',
        wait: 0,
        x: 0,
        y: 0,
        heading: 0,
        wake: [],
        wakeTimer: 0,
      };
      this.placeBoat(boat);
      this.boats.push(boat);
    }
  }

  update(dt: number, weather: WeatherLook): void {
    const storm = weather.storm > 0.5 || weather.snow > 0.7;

    // Chimney smoke: puffs are born at the chimney, rise up the screen and drift with the wind.
    const driftX = weather.windX * weather.windSpeed * 0.0004;
    const driftY = weather.windY * weather.windSpeed * 0.0002;
    for (const source of this.smoke) {
      source.timer -= dt;
      if (source.timer <= 0 && source.puffs.length < SMOKE_PUFFS) {
        source.puffs.push({ x: source.x, y: source.y, age: 0, life: SMOKE_LIFE * (0.8 + this.rng() * 0.4) });
        source.timer = source.interval;
      }
      for (const puff of source.puffs) {
        puff.age += dt;
        puff.x += driftX * dt;
        puff.y += (driftY - 0.0035) * dt;
      }
      source.puffs = source.puffs.filter((puff) => puff.age < puff.life);
    }

    for (const gull of this.gulls) {
      gull.angle += gull.speed * dt;
      gull.phase += dt;
    }

    // Sails follow the real wind; the beam sweeps at a steady pace.
    this.sailAngle += weather.windSpeed * 0.03 * dt;
    this.beamAngle += 0.6 * dt;

    for (const boat of this.boats) this.updateBoat(boat, dt, storm);
  }

  private placeBoat(boat: Boat): void {
    const curve = this.curves[boat.laneIndex];
    const point = curvePoint(curve, boat.t);
    boat.x = point.x;
    boat.y = point.y;
    boat.heading = curveHeading(curve, boat.t) + (boat.forward ? 0 : Math.PI);
  }

  private updateBoat(boat: Boat, dt: number, storm: boolean): void {
    const curve = this.curves[boat.laneIndex];
    if (boat.state === 'anchored') {
      if (!storm) {
        boat.state = 'docked';
        boat.wait = 2 + this.rng() * 3;
      }
      return;
    }
    if (boat.state === 'docked') {
      boat.wait -= dt;
      if (boat.wait > 0) return;
      if (storm) {
        boat.state = 'anchored';
        return;
      }
      this.departBoat(boat);
      return;
    }

    // Sailing. In a storm, make for the nearer shore.
    const span = this.spans[boat.laneIndex];
    if (storm) boat.forward = boat.t >= (span.min + span.max) / 2;
    const distanceToEnd = boat.forward ? span.max - boat.t : boat.t - span.min;
    const distanceFromStart = span.max - span.min - distanceToEnd;
    const ease = Math.max(0.25, Math.min(1, distanceToEnd / BOAT_EASE, distanceFromStart / BOAT_EASE + 0.25));
    const step = (BOAT_SPEED * ease * dt) / Math.max(curve.length, 0.02);
    boat.t += boat.forward ? step : -step;
    if (boat.t >= span.max || boat.t <= span.min) {
      boat.t = Math.max(span.min, Math.min(span.max, boat.t));
      boat.state = storm ? 'anchored' : 'docked';
      boat.wait = 3 + this.rng() * 4;
      boat.wake.length = 0;
    }
    this.placeBoat(boat);

    boat.wakeTimer -= dt;
    if (boat.wakeTimer <= 0) {
      boat.wake.push({ x: boat.x, y: boat.y });
      if (boat.wake.length > 6) boat.wake.shift();
      boat.wakeTimer = 0.35;
    }
  }

  /** Leave the current port along another lane that touches it, or back the way it came. */
  private departBoat(boat: Boat): void {
    const here = boat.forward ? this.laneEnds[boat.laneIndex].to : this.laneEnds[boat.laneIndex].from;
    const options = this.laneEnds
      .map((ends, index) => ({ ends, index }))
      .filter(({ ends, index }) => index !== boat.laneIndex && (ends.from === here || ends.to === here));
    if (options.length > 0) {
      const pick = options[Math.floor(this.rng() * options.length)];
      boat.laneIndex = pick.index;
      boat.forward = pick.ends.from === here;
    } else {
      boat.forward = !boat.forward;
    }
    const span = this.spans[boat.laneIndex];
    boat.t = boat.forward ? span.min : span.max;
    boat.state = 'sailing';
    boat.wake.length = 0;
    this.placeBoat(boat);
  }
}
