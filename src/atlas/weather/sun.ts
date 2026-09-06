/*
 * Sun and moon from the clock, for Astana unless told otherwise. NOAA's
 * solar position algorithm, good to a fraction of a degree; sunrise and
 * sunset to the minute. Used every frame for the day-night ramp and the
 * shadow direction, and as the fallback when the forecast is unavailable.
 */

export const ASTANA = { lat: 51.17, lng: 71.43 };

const RAD = Math.PI / 180;
const mod = (value: number, n: number): number => ((value % n) + n) % n;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

interface SolarBasics {
  /** Degrees. */
  declination: number;
  /** Minutes. */
  equationOfTime: number;
}

function solarBasics(jd: number): SolarBasics {
  const T = (jd - 2451545) / 36525;
  const L0 = mod(280.46646 + T * (36000.76983 + 0.0003032 * T), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const trueLongitude = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const epsilon0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const epsilon = epsilon0 + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(epsilon * RAD) * Math.sin(lambda * RAD)) / RAD;
  const y = Math.tan((epsilon / 2) * RAD) ** 2;
  const equationOfTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  return { declination, equationOfTime };
}

export interface SolarPosition {
  /** Degrees above the horizon; negative at night. */
  elevation: number;
  /** Degrees clockwise from north. */
  azimuth: number;
}

export function solarPosition(date: Date, lat = ASTANA.lat, lng = ASTANA.lng): SolarPosition {
  const { declination, equationOfTime } = solarBasics(julianDay(date));
  const minutesUtc = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolar = mod(minutesUtc + equationOfTime + 4 * lng, 1440);
  const hourAngle = trueSolar / 4 < 0 ? trueSolar / 4 + 180 : trueSolar / 4 - 180;
  const latR = lat * RAD;
  const decR = declination * RAD;
  const cosZenith = clamp(
    Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(hourAngle * RAD),
    -1,
    1,
  );
  const zenith = Math.acos(cosZenith) / RAD;
  const elevation = 90 - zenith;
  let azimuth = 180;
  const sinZenith = Math.sin(zenith * RAD);
  if (Math.abs(sinZenith) > 1e-6) {
    const cosAzimuth = clamp((Math.sin(latR) * cosZenith - Math.sin(decR)) / (Math.cos(latR) * sinZenith), -1, 1);
    const az = Math.acos(cosAzimuth) / RAD;
    azimuth = hourAngle > 0 ? mod(az + 180, 360) : mod(540 - az, 360);
  }
  return { elevation, azimuth };
}

/** Sunrise and sunset (as epoch milliseconds) for the UTC date of `date`, or null in polar day and night. */
export function sunTimes(
  date: Date,
  lat = ASTANA.lat,
  lng = ASTANA.lng,
): { sunrise: number; sunset: number } | null {
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const { declination, equationOfTime } = solarBasics(julianDay(new Date(dayStart + 12 * 3600000)));
  const latR = lat * RAD;
  const decR = declination * RAD;
  const cosHourAngle = Math.cos(90.833 * RAD) / (Math.cos(latR) * Math.cos(decR)) - Math.tan(latR) * Math.tan(decR);
  if (cosHourAngle < -1 || cosHourAngle > 1) return null;
  const hourAngle = Math.acos(cosHourAngle) / RAD;
  const sunriseMinutes = 720 - 4 * (lng + hourAngle) - equationOfTime;
  const sunsetMinutes = 720 - 4 * (lng - hourAngle) - equationOfTime;
  return { sunrise: dayStart + sunriseMinutes * 60000, sunset: dayStart + sunsetMinutes * 60000 };
}

export interface MoonPhase {
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  phase: number;
  /** Lit fraction of the disc, 0 to 1. */
  illumination: number;
  waxing: boolean;
}

/** From the mean synodic month, counted from the new moon of 6 January 2000. */
export function moonPhase(date: Date): MoonPhase {
  const phase = mod((julianDay(date) - 2451550.1) / 29.530588853, 1);
  return { phase, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2, waxing: phase < 0.5 };
}
