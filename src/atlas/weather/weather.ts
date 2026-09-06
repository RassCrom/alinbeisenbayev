import { useCallback, useEffect, useState } from 'react';
import { solarPosition, sunTimes } from './sun.ts';

/*
 * The weather the map lives under: Astana's, from the Open-Meteo forecast
 * API. Fetched at most every fifteen minutes, cached in localStorage with a
 * timestamp, and replaced by a clock-based fallback (clear sky, seasonal
 * temperature, day or night from the sun) when the fetch fails or the cache
 * is over an hour old. Presets exist so the HUD can preview any weather;
 * a preset never persists.
 */

export type Condition =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export type WeatherSource = 'live' | 'cached' | 'fallback' | 'preset';

export interface WeatherState {
  source: WeatherSource;
  /** When the observation was made, epoch ms. */
  observedAt: number;
  /** WMO weather interpretation code. */
  code: number;
  condition: Condition;
  /** Precipitation strength, 0 to 1. */
  intensity: number;
  /** °C */
  temperature: number;
  /** km/h */
  windSpeed: number;
  /** Degrees the wind comes from, clockwise from north. */
  windDirection: number;
  /** 0 to 1 */
  cloudCover: number;
  isDay: boolean;
  /** Epoch ms, or null when unknown. */
  sunrise: number | null;
  sunset: number | null;
}

export const CONDITION_LABEL: Record<Condition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  overcast: 'Overcast',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  thunderstorm: 'Thunderstorm',
};

/** WMO code to what the map draws. Intensity spreads light, moderate and heavy. */
export function conditionFromCode(code: number): { condition: Condition; intensity: number } {
  switch (code) {
    case 0:
    case 1:
      return { condition: 'clear', intensity: 0 };
    case 2:
      return { condition: 'partly-cloudy', intensity: 0 };
    case 3:
      return { condition: 'overcast', intensity: 0 };
    case 45:
    case 48:
      return { condition: 'fog', intensity: 0 };
    case 51:
      return { condition: 'drizzle', intensity: 0.3 };
    case 53:
    case 56:
      return { condition: 'drizzle', intensity: 0.5 };
    case 55:
    case 57:
      return { condition: 'drizzle', intensity: 0.7 };
    case 61:
      return { condition: 'rain', intensity: 0.4 };
    case 63:
    case 66:
    case 80:
      return { condition: 'rain', intensity: 0.65 };
    case 65:
    case 67:
    case 81:
      return { condition: 'rain', intensity: 0.85 };
    case 82:
      return { condition: 'rain', intensity: 1 };
    case 71:
    case 77:
      return { condition: 'snow', intensity: 0.4 };
    case 73:
    case 85:
      return { condition: 'snow', intensity: 0.65 };
    case 75:
    case 86:
      return { condition: 'snow', intensity: 0.95 };
    case 95:
      return { condition: 'thunderstorm', intensity: 0.7 };
    case 96:
    case 99:
      return { condition: 'thunderstorm', intensity: 1 };
    default:
      return { condition: 'overcast', intensity: 0 };
  }
}

/* ---- Fetch and cache ---------------------------------------------------- */

export const WEATHER_KEY = 'atlas:weather';
export const POLL_MS = 15 * 60 * 1000;
/** Beyond this the cache is stale and the fallback takes over. */
const STALE_MS = 60 * 60 * 1000;

const ENDPOINT =
  'https://api.open-meteo.com/v1/forecast?latitude=51.17&longitude=71.43' +
  '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,is_day' +
  '&daily=sunrise,sunset&timezone=auto&forecast_days=1&wind_speed_unit=kmh';

interface OpenMeteoResponse {
  utc_offset_seconds: number;
  current: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    cloud_cover: number;
    is_day: number;
  };
  daily: { sunrise: string[]; sunset: string[] };
}

/** Open-Meteo returns local ISO times without an offset; the offset comes separately. */
function localIsoToEpoch(iso: string | undefined, offsetSeconds: number): number | null {
  if (!iso) return null;
  const parsed = Date.parse(`${iso}Z`);
  return Number.isFinite(parsed) ? parsed - offsetSeconds * 1000 : null;
}

export async function fetchAstanaWeather(signal?: AbortSignal): Promise<WeatherState> {
  const response = await fetch(ENDPOINT, { signal });
  if (!response.ok) throw new Error(`Open-Meteo answered ${response.status}`);
  const data = (await response.json()) as OpenMeteoResponse;
  const { condition, intensity } = conditionFromCode(data.current.weather_code);
  return {
    source: 'live',
    observedAt: Date.now(),
    code: data.current.weather_code,
    condition,
    intensity,
    temperature: data.current.temperature_2m,
    windSpeed: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    cloudCover: Math.min(1, Math.max(0, data.current.cloud_cover / 100)),
    isDay: data.current.is_day === 1,
    sunrise: localIsoToEpoch(data.daily.sunrise[0], data.utc_offset_seconds),
    sunset: localIsoToEpoch(data.daily.sunset[0], data.utc_offset_seconds),
  };
}

export function readCachedWeather(now = Date.now()): WeatherState | null {
  try {
    const raw = localStorage.getItem(WEATHER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherState;
    if (typeof parsed.observedAt !== 'number' || now - parsed.observedAt > STALE_MS) return null;
    return { ...parsed, source: 'cached' };
  } catch {
    return null;
  }
}

function writeCachedWeather(state: WeatherState): void {
  try {
    localStorage.setItem(WEATHER_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full store: the state still holds in memory.
  }
}

/* ---- Fallback and presets ------------------------------------------------ */

/** Astana's monthly normals, °C, January first. */
const NORMAL_TEMPERATURE = [-14, -13, -6, 6, 14, 19, 21, 19, 13, 4, -6, -12];

/** Clear sky, seasonal temperature, day or night from the sun. */
export function fallbackWeather(now = Date.now()): WeatherState {
  const date = new Date(now);
  const times = sunTimes(date);
  return {
    source: 'fallback',
    observedAt: now,
    code: 0,
    condition: 'clear',
    intensity: 0,
    temperature: NORMAL_TEMPERATURE[date.getMonth()],
    windSpeed: 10,
    windDirection: 225,
    cloudCover: 0.2,
    isDay: solarPosition(date).elevation > 0,
    sunrise: times?.sunrise ?? null,
    sunset: times?.sunset ?? null,
  };
}

export type WeatherPreset =
  | 'clear-day'
  | 'clear-night'
  | 'summer-sun'
  | 'overcast'
  | 'rain'
  | 'snow'
  | 'blizzard'
  | 'thunderstorm'
  | 'fog';

export const PRESET_LABEL: Record<WeatherPreset, string> = {
  'clear-day': 'Clear day',
  'clear-night': 'Clear night',
  'summer-sun': 'Summer sun',
  overcast: 'Overcast',
  rain: 'Rain',
  snow: 'Snow',
  blizzard: 'Blizzard at night',
  thunderstorm: 'Thunderstorm',
  fog: 'Fog',
};

export function presetWeather(preset: WeatherPreset, now = Date.now()): WeatherState {
  const base: WeatherState = {
    ...fallbackWeather(now),
    source: 'preset',
    isDay: true,
  };
  switch (preset) {
    case 'clear-day':
      return { ...base, temperature: 12, windSpeed: 8, cloudCover: 0.1 };
    case 'clear-night':
      return { ...base, isDay: false, temperature: 4, windSpeed: 6, cloudCover: 0.05 };
    case 'summer-sun':
      return { ...base, temperature: 31, windSpeed: 12, windDirection: 180, cloudCover: 0.15 };
    case 'overcast':
      return { ...base, code: 3, condition: 'overcast', temperature: 9, windSpeed: 18, cloudCover: 0.95 };
    case 'rain':
      return { ...base, code: 63, condition: 'rain', intensity: 0.7, temperature: 11, windSpeed: 22, windDirection: 270, cloudCover: 0.9 };
    case 'snow':
      return { ...base, code: 73, condition: 'snow', intensity: 0.65, temperature: -6, windSpeed: 14, windDirection: 20, cloudCover: 0.9 };
    case 'blizzard':
      return { ...base, isDay: false, code: 75, condition: 'snow', intensity: 1, temperature: -18, windSpeed: 46, windDirection: 330, cloudCover: 1 };
    case 'thunderstorm':
      return { ...base, code: 95, condition: 'thunderstorm', intensity: 0.85, temperature: 17, windSpeed: 30, windDirection: 250, cloudCover: 1 };
    case 'fog':
      return { ...base, code: 45, condition: 'fog', temperature: 2, windSpeed: 3, cloudCover: 0.7 };
    default:
      return base;
  }
}

/* ---- Hook ---------------------------------------------------------------- */

export interface WeatherHandle {
  /** The live, cached or fallback state; never a preset. */
  weather: WeatherState;
  /** Set when the last fetch failed; the state is then cached or fallback. */
  error: string | null;
  refresh: () => void;
}

/**
 * The current Astana weather for React, polling every fifteen minutes and
 * again when the tab comes back after the cache went stale.
 */
export function useWeather(): WeatherHandle {
  const [weather, setWeather] = useState<WeatherState>(() => readCachedWeather() ?? fallbackWeather());
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;

    const load = async (): Promise<void> => {
      const cached = readCachedWeather();
      if (cached && Date.now() - cached.observedAt < POLL_MS) {
        setWeather(cached);
        return;
      }
      try {
        const live = await fetchAstanaWeather(controller.signal);
        writeCachedWeather(live);
        setWeather(live);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setWeather(cached ?? fallbackWeather());
      }
    };

    const onVisibility = (): void => {
      if (!document.hidden) void load();
    };

    void load();
    timer = window.setInterval(() => void load(), POLL_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tick]);

  return { weather, error, refresh };
}

/* ---- Small formatters for the HUD ------------------------------------------ */

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compassPoint(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

export function formatTemperature(celsius: number): string {
  const rounded = Math.round(celsius);
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)}°C`;
}
