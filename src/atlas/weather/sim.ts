import { solarPosition } from './sun.ts';
import type { WeatherState } from './weather.ts';

/*
 * What the shaders actually receive: a set of blended numbers. The target
 * look is computed from the weather state and the clock; the simulation
 * eases the live look toward it over ten seconds so a change of weather
 * cross-fades instead of snapping, keeps the snow cover as a memory that
 * grows while it snows and melts above freezing, and fires lightning.
 */

export interface WeatherLook {
  /** Precipitation and sky, each 0 to 1. */
  rain: number;
  snow: number;
  cloud: number;
  haze: number;
  storm: number;
  /** Sea ice along the coasts, 0 to 1. */
  ice: number;
  /** Snow lying on the land, 0 to 1. */
  snowCover: number;
  /** Lightning brightness, decays quickly. */
  flash: number;
  /** Unit vector the wind blows toward: x east, y south. */
  windX: number;
  windY: number;
  /** km/h */
  windSpeed: number;
  /** 0 night to 1 day, with a twilight ramp. */
  day: number;
  /** Warmth of the light at dawn and dusk, 0 to 1. */
  dusk: number;
  /** Direction toward the sun: x east, y south, z up. Unit length. */
  sunX: number;
  sunY: number;
  sunZ: number;
  /** °C, for melting. */
  temperature: number;
  /** Multiplier on the island paintings for the season. */
  tintR: number;
  tintG: number;
  tintB: number;
}

const CROSSFADE_SECONDS = 10;
/** Seconds of steady snowfall to cover the land. */
const SNOW_ACCUMULATE_SECONDS = 60;
/** Seconds to melt full cover at +5°C. */
const MELT_SECONDS = 90;

const DEG = Math.PI / 180;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Autumn foliage in October and November, fresh green in April and May, neutral otherwise. */
export function seasonTint(date: Date): [number, number, number] {
  const month = date.getMonth();
  if (month === 9 || month === 10) return [1.08, 0.9, 0.7];
  if (month === 3 || month === 4) return [0.94, 1.06, 0.88];
  return [1, 1, 1];
}

/** The look the weather state asks for right now. */
export function targetLook(state: WeatherState, now: number): WeatherLook {
  const date = new Date(now);
  const sun = solarPosition(date);
  // A preset decides day or night itself; live weather follows the real sun.
  const elevation = state.source === 'preset' ? (state.isDay ? 35 : -30) : sun.elevation;
  const azimuth = state.source === 'preset' ? (state.isDay ? 150 : 0) : sun.azimuth;
  const day = smoothstep(-8, 8, elevation);
  const dusk = (1 - Math.abs(day - 0.5) * 2) * smoothstep(-10, 2, elevation) * smoothstep(20, 4, elevation);
  const lit = Math.max(elevation, 4) * DEG;
  const azimuthR = azimuth * DEG;
  const sunX = Math.sin(azimuthR) * Math.cos(lit);
  const sunY = -Math.cos(azimuthR) * Math.cos(lit);
  const sunZ = Math.sin(lit);

  const precipitation = state.intensity;
  const rain = state.condition === 'rain' || state.condition === 'drizzle' || state.condition === 'thunderstorm' ? precipitation : 0;
  const snow = state.condition === 'snow' ? precipitation : 0;
  const cloud =
    state.condition === 'thunderstorm'
      ? 1
      : Math.max(state.cloudCover, rain > 0 || snow > 0 ? 0.75 : 0, state.condition === 'overcast' ? 0.9 : 0);
  const haze = state.condition === 'fog' ? 1 : 0;
  const storm = state.condition === 'thunderstorm' ? 1 : 0;
  const ice = state.temperature < 0 ? clamp01(-state.temperature / 10) : 0;
  const windToward = (state.windDirection + 180) * DEG;
  const [tintR, tintG, tintB] = seasonTint(date);

  return {
    rain,
    snow,
    cloud,
    haze,
    storm,
    ice,
    snowCover: 0,
    flash: 0,
    windX: Math.sin(windToward),
    windY: -Math.cos(windToward),
    windSpeed: state.windSpeed,
    day,
    dusk,
    sunX,
    sunY,
    sunZ,
    temperature: state.temperature,
    tintR,
    tintG,
    tintB,
  };
}

/** Snow already lying when the map opens: a snowy sky or a hard frost means white ground. */
export function initialSnowCover(state: WeatherState): number {
  if (state.condition === 'snow') return 0.75;
  if (state.temperature < -3) return 0.6;
  return 0;
}

const BLENDED: (keyof WeatherLook)[] = [
  'rain', 'snow', 'cloud', 'haze', 'storm', 'ice', 'windX', 'windY', 'windSpeed',
  'day', 'dusk', 'sunX', 'sunY', 'sunZ', 'temperature', 'tintR', 'tintG', 'tintB',
];

export class WeatherSim {
  readonly look: WeatherLook;
  private nextFlash = 4;
  private echo = 0;

  constructor(initial: WeatherLook, snowCover: number) {
    this.look = { ...initial, snowCover, flash: 0 };
  }

  /** Advance by `dt` seconds toward `target`. With `instant`, every value snaps and lightning is off. */
  update(dt: number, target: WeatherLook, instant: boolean): void {
    const look = this.look;
    const step = instant ? 1 : Math.min(1, dt / CROSSFADE_SECONDS);
    for (const key of BLENDED) {
      const goal = target[key];
      const delta = goal - look[key];
      // Linear ramp, so a full change takes the whole cross-fade and a small one less.
      look[key] += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;
    }
    const length = Math.hypot(look.windX, look.windY) || 1;
    look.windX /= length;
    look.windY /= length;
    const sunLength = Math.hypot(look.sunX, look.sunY, look.sunZ) || 1;
    look.sunX /= sunLength;
    look.sunY /= sunLength;
    look.sunZ /= sunLength;

    // Snow lies while it falls and goes when it warms.
    if (look.snow > 0.05) look.snowCover += (dt / SNOW_ACCUMULATE_SECONDS) * look.snow;
    if (look.temperature > 0) look.snowCover -= (dt / MELT_SECONDS) * (0.4 + look.temperature / 5);
    look.snowCover = clamp01(look.snowCover);

    // Lightning: a flash every few seconds in a storm, often doubled.
    if (instant) {
      look.flash = 0;
      return;
    }
    look.flash *= Math.exp(-dt * 7);
    if (look.storm > 0.3) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        look.flash = 0.7 + Math.random() * 0.3;
        this.nextFlash = 3 + Math.random() * 9;
        this.echo = Math.random() < 0.6 ? 0.1 + Math.random() * 0.15 : 0;
      }
      if (this.echo > 0) {
        this.echo -= dt;
        if (this.echo <= 0) look.flash = Math.max(look.flash, 0.5 + Math.random() * 0.3);
      }
    }
  }
}
