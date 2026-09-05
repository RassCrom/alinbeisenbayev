# Stage 4 of 7: live Astana weather, seasons, moon, day and night

## Context

Read `docs/atlas-status.md` first. Stages 1 to 3 built a WebGL archipelago at
`/` in `src/atlas/` with camera, hover, routing, fog of war and a HUD that has
a placeholder weather readout. Branch: `experiment-map`.

Weather references: `docs/concepts/08-realistic-night-blizzard.png` for snow
and sea ice, `09-realistic-summer-sun.png` for sun, shadows and cloud
shadows, `11-realistic-orbital-night.png` for the night look and lightning.

## This stage

### 1. Source

Fetch the Open-Meteo forecast API for Astana, 51.17 N, 71.43 E: current
weather code, temperature, wind speed and direction, cloud cover, plus
sunrise and sunset. Poll every 15 minutes, cache in localStorage with a
timestamp, and fall back to clock-based day and night when the fetch fails
or is stale. Put the fetch, cache and WMO-code mapping in one module with a
typed `WeatherState`.

### 2. Effects

A fragment shader stack over the composite, driven by `WeatherState`:

- rain and snow particles slanted by wind speed and direction;
- a snow accumulation mask on land that grows while snowing and melts
  above 0°C;
- sea ice along coastlines when temperature is below 0°C;
- clouds drifting with the wind, casting soft shadows on land, density from
  cloud cover;
- fog for fog codes;
- sun glitter on shallows and a shadow direction that follows the real hour;
- lightning flashes for thunderstorm codes;
- day and night tint from sunrise and sunset, with window glow strongest at
  night.

Weather changes cross-fade over ten seconds rather than snapping.

### 3. Date-driven layers

- Seasons: an autumn foliage tint in October and November and a spring
  meadow tint in April and May, applied to the island paintings.
- Night sky shows the real lunar phase computed from the date.

### 4. HUD

Replace the placeholder readout with the live condition icon, temperature
and wind, as in concept 10. One line under it says the map lives in Astana's
weather. A small picker lets the visitor override the weather for preview;
it never persists.

## Constraints

- tsc and the production build stay clean.
- No new runtime dependencies beyond `fetch`.
- Cap particle counts; measure and note the frame time on a mid-range laptop.
- Under prefers-reduced-motion the weather layer renders a static frame.

## Done when

- Live weather is visible and the readout matches the API, verified with a
  screenshot and a network log;
- every override in the picker renders correctly, with screenshots of snow,
  rain, sun and night;
- `docs/atlas-status.md` is updated with the weather module API, shader
  list, cache key and anything deferred;
- everything is committed on `experiment-map`.
