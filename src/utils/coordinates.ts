export interface FormatCoordinatesOptions {
  /** Decimal places per axis. Defaults to 1. */
  precision?: number;
  /** String placed between the latitude and longitude parts. Defaults to a space. */
  separator?: string;
}

/** Formats a lat/lng pair as e.g. `48.2°N 16.4°E`. */
export function formatCoordinates(
  lat: number,
  lng: number,
  { precision = 1, separator = ' ' }: FormatCoordinatesOptions = {},
): string {
  const latitude = `${Math.abs(lat).toFixed(precision)}°${lat >= 0 ? 'N' : 'S'}`;
  const longitude = `${Math.abs(lng).toFixed(precision)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${latitude}${separator}${longitude}`;
}
