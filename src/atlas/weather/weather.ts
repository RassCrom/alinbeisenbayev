import { useEffect, useState } from 'react';
import { solarPosition, sunTimes } from './sun.ts';

/*
 * The weather the map lives under. There is no forecast behind it: the site
 * takes no live data from third-party APIs. The default is a clear sky with
 * day and night from the real sun over Astana; the month's normal
 * temperature only steers the simulation (ice, snow cover) and is never
 * shown as a reading. Presets let the HUD preview any weather; a preset
 * never persists.
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

export type WeatherSource = 'clock' | 'preset';

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

/* ---- Clock sky and presets ----------------------------------------------- */

/** Astana's monthly normals, °C, January first. */
const NORMAL_TEMPERATURE = [-14, -13, -6, 6, 14, 19, 21, 19, 13, 4, -6, -12];

/** Clear sky, seasonal temperature, day or night from the sun. */
export function clockWeather(now = Date.now()): WeatherState {
  const date = new Date(now);
  const times = sunTimes(date);
  return {
    source: 'clock',
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
    ...clockWeather(now),
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

/** How often the clock sky is recomputed, so day turns to night on time. */
const CLOCK_MS = 60 * 1000;

/** The clock sky for React, recomputed every minute. */
export function useClockWeather(): WeatherState {
  const [weather, setWeather] = useState<WeatherState>(() => clockWeather());

  useEffect(() => {
    const timer = window.setInterval(() => setWeather(clockWeather()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return weather;
}
