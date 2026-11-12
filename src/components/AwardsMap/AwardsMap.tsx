import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker, Popup } from 'maplibre-gl';
import type { Award, AwardPlace, StatusKey } from '../../data/mapAwards';
import { statusOf } from '../../data/mapAwards';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = '/map-styles/portfolio-dark.json';

/*
 * Paint colours are raw hex: MapLibre paint properties live outside the CSS
 * cascade (same deliberate scope cut as WorksMap). The basemap is dark in both
 * site themes, so these only have to read on dark.
 */
export const STATUS_COLOR: Record<StatusKey, string> = {
  open: '#5cc98b',
  running: '#5cc98b',
  firm: '#6f9ed4',
  expected: '#e0aa52',
  tba: '#b08f58',
  closed: '#6b7690',
};

/** When a pin holds several programs, it takes the colour of the most urgent one. */
const URGENCY: StatusKey[] = ['open', 'running', 'firm', 'expected', 'tba', 'closed'];

interface Props {
  awards: Award[];
  places: Record<string, AwardPlace>;
  selectedPlace: string | null;
  onSelectPlace: (key: string) => void;
  /** While true, a click on the map drops the new-entry pin instead of selecting. */
  pickMode?: boolean;
  picked?: { lng: number; lat: number } | null;
  onPick?: (p: { lng: number; lat: number }) => void;
  /** Pixels covered by the floating panel on the left, kept clear when framing. */
  leftInset?: number;
  /** Pixels covered by a bottom sheet (phones). */
  bottomInset?: number;
}

function toGeoJSON(awards: Award[], places: Record<string, AwardPlace>): GeoJSON.FeatureCollection {
  const groups = new Map<string, Award[]>();
  for (const a of awards) {
    const list = groups.get(a.place) ?? [];
    list.push(a);
    groups.set(a.place, list);
  }
  const features: GeoJSON.Feature[] = [];
  for (const [key, list] of groups) {
    const place = places[key];
    if (!place) continue;
    const statuses = list.map((a) => statusOf(a));
    const top = URGENCY.find((s) => statuses.includes(s)) ?? 'tba';
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
      properties: {
        key,
        name: place.name,
        detail: place.detail,
        approx: Boolean(place.approx),
        count: list.length,
        color: STATUS_COLOR[top],
        titles: list.map((a) => a.name).join('\n'),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export default function AwardsMap({
  awards,
  places,
  selectedPlace,
  onSelectPlace,
  pickMode = false,
  picked = null,
  onPick,
  leftInset = 0,
  bottomInset = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const selectRef = useRef(onSelectPlace);
  selectRef.current = onSelectPlace;
  const pickRef = useRef({ pickMode, onPick });
  pickRef.current = { pickMode, onPick };
  const insetRef = useRef({ left: leftInset, bottom: bottomInset });
  insetRef.current = { left: leftInset, bottom: bottomInset };

  // Create the map once.
  useEffect(() => {
    let map: MapLibreMap | null = null;
    let popup: Popup | null = null;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;
      libRef.current = maplibregl;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [20, 32],
        zoom: 1.3,
        minZoom: 0.8,
        maxZoom: 9,
        renderWorldCopies: false,
        attributionControl: false,
        cooperativeGestures: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: '280px' });

      // Globe, same treatment as the Works map: a lighter sphere and a limb
      // glow so it reads against the near-black page.
      map.on('style.load', () => {
        if (!map) return;
        map.setProjection({ type: 'globe' });
        map.setPaintProperty('background', 'background-color', '#141f38');
        map.setSky({
          'sky-color': '#0d1320',
          'horizon-color': '#1d3557',
          'fog-color': '#101a2e',
          'sky-horizon-blend': 0.8,
          'horizon-fog-blend': 0.8,
          'fog-ground-blend': 0.3,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 5, 0.7, 7, 0],
        });
      });

      map.on('load', () => {
        if (!map) return;
        map.addSource('awards', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'awards-halo',
          type: 'circle',
          source: 'awards',
          paint: {
            'circle-radius': ['+', 9, ['*', 3.2, ['sqrt', ['get', 'count']]]],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.18,
          },
        });
        map.addLayer({
          id: 'awards-selected',
          type: 'circle',
          source: 'awards',
          filter: ['==', ['get', 'key'], ''],
          paint: {
            'circle-radius': ['+', 12, ['*', 3.2, ['sqrt', ['get', 'count']]]],
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#dce3ef',
            'circle-stroke-width': 2,
          },
        });
        map.addLayer({
          id: 'awards-dot',
          type: 'circle',
          source: 'awards',
          paint: {
            'circle-radius': ['+', 4, ['*', 2.4, ['sqrt', ['get', 'count']]]],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#0d1320',
            'circle-stroke-width': 1.5,
            // Approximate pins (a country, not an address) are drawn hollow-ish.
            'circle-opacity': ['case', ['get', 'approx'], 0.55, 1],
          },
        });
        map.addLayer({
          id: 'awards-count',
          type: 'symbol',
          source: 'awards',
          filter: ['>', ['get', 'count'], 1],
          layout: {
            'text-field': ['to-string', ['get', 'count']],
            'text-font': ['Open Sans Bold'],
            'text-size': 11,
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#0d1320' },
        });
        map.addLayer({
          id: 'awards-label',
          type: 'symbol',
          source: 'awards',
          minzoom: 2.2,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Montserrat Medium'],
            'text-size': 11,
            'text-offset': [0, 1.6],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': '#9aa8c2', 'text-halo-color': '#0d1320', 'text-halo-width': 1.2 },
        });

        const show = (e: MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f || !map || !popup) return;
          map.getCanvas().style.cursor = 'pointer';
          const p = f.properties as { name: string; detail: string; count: number; titles: string; approx: boolean };
          const el = document.createElement('div');
          el.className = 'awards-popup';
          const h = document.createElement('strong');
          h.textContent = `${p.name} · ${p.count} ${p.count === 1 ? 'program' : 'programs'}`;
          const d = document.createElement('span');
          d.textContent = p.approx ? `${p.detail} (approximate pin)` : p.detail;
          const ul = document.createElement('ul');
          for (const t of String(p.titles).split('\n').slice(0, 6)) {
            const li = document.createElement('li');
            li.textContent = t;
            ul.appendChild(li);
          }
          if (p.count > 6) {
            const li = document.createElement('li');
            li.textContent = `+ ${p.count - 6} more`;
            ul.appendChild(li);
          }
          el.append(h, d, ul);
          popup.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(el).addTo(map);
        };
        map.on('mousemove', 'awards-dot', (e) => {
          if (!pickRef.current.pickMode) show(e);
        });
        map.on('mouseleave', 'awards-dot', () => {
          if (!map) return;
          map.getCanvas().style.cursor = '';
          popup?.remove();
        });
        map.on('click', 'awards-dot', (e) => {
          if (pickRef.current.pickMode) return;
          const key = e.features?.[0]?.properties?.key;
          if (typeof key === 'string') selectRef.current(key);
        });
        map.on('click', (e) => {
          const { pickMode: picking, onPick: pick } = pickRef.current;
          if (picking && pick) pick({ lng: +e.lngLat.lng.toFixed(4), lat: +e.lngLat.lat.toFixed(4) });
        });
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      popup?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Push the filtered set into the source.
  const framedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const data = toGeoJSON(awards, places);
    (map.getSource('awards') as GeoJSONSource | undefined)?.setData(data);
    // Frame every pin once, on first data; later filter changes keep the view.
    if (!framedRef.current && data.features.length > 1) {
      framedRef.current = true;
      const lngs = data.features.map((f) => (f.geometry as GeoJSON.Point).coordinates[0]);
      const lats = data.features.map((f) => (f.geometry as GeoJSON.Point).coordinates[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        {
          padding: { top: 70, bottom: 60 + insetRef.current.bottom, left: 40 + insetRef.current.left, right: 60 },
          duration: 0,
          maxZoom: 3,
        },
      );
    }
  }, [ready, awards, places]);

  // Ring and fly to the selected place.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter('awards-selected', ['==', ['get', 'key'], selectedPlace ?? '']);
    const place = selectedPlace ? places[selectedPlace] : null;
    if (place) {
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: Math.max(map.getZoom(), place.approx ? 3 : 4.5),
        speed: 1.4,
        padding: { left: insetRef.current.left, bottom: insetRef.current.bottom, top: 0, right: 0 },
      });
    }
  }, [ready, selectedPlace, places]);

  // Pick mode: crosshair cursor and a draggable pin for the new entry.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    map.getCanvas().style.cursor = pickMode ? 'crosshair' : '';
    if (!pickMode || !picked) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      const el = document.createElement('div');
      el.className = 'awards-new-pin';
      el.setAttribute('aria-label', 'New award location');
      const pin = new lib.Marker({ element: el, draggable: true, anchor: 'bottom' })
        .setLngLat([picked.lng, picked.lat])
        .addTo(map);
      pinRef.current = pin;
      pin.on('dragend', () => {
        const p = pinRef.current?.getLngLat();
        if (p) pickRef.current.onPick?.({ lng: +p.lng.toFixed(4), lat: +p.lat.toFixed(4) });
      });
    } else {
      pinRef.current.setLngLat([picked.lng, picked.lat]);
    }
  }, [ready, pickMode, picked]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="awards-map h-full w-full" aria-label="Map of award and competition locations" role="region" />
      <div
        style={{ left: leftInset + 12, bottom: bottomInset + 12 }}
        className="awards-legend pointer-events-none absolute flex max-w-[calc(100%-120px)] flex-wrap gap-x-3 gap-y-1 rounded-[var(--radius-md)] bg-[rgba(13,19,32,0.82)] px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] text-[#9aa8c2]">
        {(
          [
            ['open', 'Open / running'],
            ['firm', 'Date confirmed'],
            ['expected', 'Expected'],
            ['closed', 'Closed'],
          ] as [StatusKey, string][]
        ).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#6f9ed4] opacity-55" />
          Faded = approximate place
        </span>
      </div>
    </div>
  );
}
