import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl';
import type { Project } from '../../types';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = '/map-styles/portfolio-dark.json';

const HUBS = [
  { key: 'astana',    lat: 51.1694,  lng: 71.4704,   label: 'Astana, Kazakhstan' },
  { key: 'longbeach', lat: 33.7701,  lng: -118.1937, label: 'Long Beach, USA' },
  { key: 'munich',    lat: 48.1351,  lng: 11.582,    label: 'Munich, Germany' },
  { key: 'vienna',    lat: 48.2082,  lng: 16.3738,   label: 'Vienna, Austria' },
  { key: 'dresden',   lat: 51.0504,  lng: 13.7373,   label: 'Dresden, Germany' },
] as const;

type Hub = typeof HUBS[number];

type ContextPoint = {
  project: Project;
  label: string;
  lat: number;
  lng: number;
  hubKey: string;
};

type MarkerRecord = {
  projectIds: string[];
  el: HTMLElement;
  /** Context markers belong to a hub; origin markers use null. */
  hubKey: string | null;
  /** Set only for origin markers so the active hub can be styled. */
  originKey?: string;
};

function distanceSquaredOnGlobe(lat: number, lng: number, hub: Hub): number {
  const latitudeScale = Math.cos(((lat + hub.lat) / 2) * (Math.PI / 180));
  const lngDelta = (hub.lng - lng) * latitudeScale;
  return (hub.lat - lat) ** 2 + lngDelta ** 2;
}

function nearestHub(lat: number, lng: number): Hub {
  return HUBS.reduce<Hub>((best, hub) => {
    const d = distanceSquaredOnGlobe(lat, lng, hub);
    const bd = distanceSquaredOnGlobe(lat, lng, best);
    return d < bd ? hub : best;
  }, HUBS[0]);
}

function contextTarget(context: Project['geography']['contexts'][number]): [number, number] | null {
  if (context.connectionType === 'polygon') {
    return context.centroidLng !== undefined && context.centroidLat !== undefined
      ? [context.centroidLng, context.centroidLat]
      : null;
  }

  return context.lng !== undefined && context.lat !== undefined
    ? [context.lng, context.lat]
    : null;
}

function formatCoordinates(lat: number, lng: number): string {
  const latitude = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`;
  const longitude = `${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${latitude} · ${longitude}`;
}

function arcCoords(
  from: [number, number],
  to: [number, number],
  steps = 48,
): [number, number][] {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx - (y2 - y1) * 0.25;
  const cy = my + (x2 - x1) * 0.25;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    coords.push([x, y]);
  }
  return coords;
}

function buildPopupHeader(
  eyebrow: string,
  label: string,
  lat: number,
  lng: number,
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'map-popup-location';

  const kind = document.createElement('span');
  kind.className = 'map-popup-location__kind';
  kind.textContent = eyebrow;

  const name = document.createElement('strong');
  name.className = 'map-popup-location__name';
  name.textContent = label;

  const coordinates = document.createElement('span');
  coordinates.className = 'map-popup-location__coordinates';
  coordinates.textContent = formatCoordinates(lat, lng);

  header.append(kind, name, coordinates);
  return header;
}

function buildPopupCard(
  project: Project,
  onView: () => void,
  location?: { eyebrow: string; label: string; lat: number; lng: number },
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'map-popup-card';
  if (location) {
    el.append(buildPopupHeader(location.eyebrow, location.label, location.lat, location.lng));
  }
  const img = document.createElement('img');
  img.src = project.coverImage;
  img.alt = project.title;
  img.style.cssText = 'width:100%;aspect-ratio:16/9;object-fit:cover;display:block;';
  const body = document.createElement('div');
  body.style.cssText = 'padding:10px 12px;';
  const category = document.createElement('div');
  category.textContent = project.category;
  category.style.cssText =
    'font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;color:var(--color-text-muted);';
  const title = document.createElement('div');
  title.textContent = project.title;
  title.style.cssText =
    'font-family:var(--font-heading);font-weight:700;font-size:14px;color:var(--color-text-primary);margin-top:2px;';
  const cta = document.createElement('div');
  cta.textContent = 'View case study →';
  cta.style.cssText =
    'font-family:var(--font-mono);font-size:11px;color:var(--color-accent-light);margin-top:6px;';
  body.append(category, title, cta);
  el.append(img, body);
  el.tabIndex = 0;
  el.setAttribute('role', 'link');
  el.setAttribute('aria-label', `View ${project.title}`);
  el.addEventListener('click', onView);
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onView();
    }
  });
  return el;
}

function buildProjectListPopup(
  projects: Project[],
  location: { eyebrow: string; label: string; lat: number; lng: number },
  onNavigate: (slug: string) => void,
): HTMLElement {
  if (projects.length === 1) {
    return buildPopupCard(
      projects[0],
      () => onNavigate(projects[0].slug),
      location,
    );
  }
  const el = document.createElement('div');
  el.className = 'map-popup-list';
  el.append(buildPopupHeader(location.eyebrow, location.label, location.lat, location.lng));
  projects.forEach((project) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'map-popup-list__item';
    const cat = document.createElement('div');
    cat.textContent = project.category;
    cat.style.cssText =
      'font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;color:var(--color-text-muted);';
    const titleEl = document.createElement('div');
    titleEl.textContent = project.title;
    titleEl.style.cssText =
      'font-family:var(--font-heading);font-weight:600;font-size:12px;' +
      'color:var(--color-text-primary);line-height:1.3;margin-top:2px;';
    const cta = document.createElement('div');
    cta.textContent = 'View →';
    cta.style.cssText =
      'font-family:var(--font-mono);font-size:10px;color:var(--color-accent-light);margin-top:3px;';
    item.append(cat, titleEl, cta);
    item.addEventListener('click', () => onNavigate(project.slug));
    el.append(item);
  });
  return el;
}

export interface WorksMapProps {
  projects: Project[];
  visibleIds?: string[];
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function WorksMap({
  projects,
  visibleIds,
  expanded = false,
  onToggleExpand,
}: WorksMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const coordinateReadoutRef = useRef<HTMLSpanElement>(null);
  const markersRef = useRef<MarkerRecord[]>([]);
  const polygonLayersRef = useRef<{ projectId: string; hubKey: string; layerIds: string[] }[]>([]);
  const visibleIdsRef = useRef<string[] | undefined>(visibleIds);
  visibleIdsRef.current = visibleIds;
  const activeHubRef = useRef<string | null>(null);
  const hubProjectIdsRef = useRef(new Map<string, string[]>());
  const fitVisibleRef = useRef<() => void>(() => {});
  const fitHubRef = useRef<(hubKey: string) => void>(() => {});
  const [activeHubKey, setActiveHubKey] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // const visibleStats = useMemo(() => {
  //   const visible = visibleIds ? new Set(visibleIds) : null;
  //   const visibleProjects = projects.filter((project) => !visible || visible.has(project.id));
  //   const hubs = new Set<string>();
  //   const places = new Set<string>();

  //   visibleProjects.forEach((project) => {
  //     if (project.geography.origin) {
  //       hubs.add(nearestHub(project.geography.origin.lat, project.geography.origin.lng).key);
  //     }
  //     project.geography.contexts.forEach((context) => {
  //       const target = contextTarget(context);
  //       if (target) places.add(`${target[0].toFixed(4)}:${target[1].toFixed(4)}`);
  //     });
  //   });

  //   return {
  //     projectCount: visibleProjects.length,
  //     hubCount: hubs.size,
  //     placeCount: places.size,
  //   };
  // }, [projects, visibleIds]);

  const activeHub = activeHubKey
    ? HUBS.find((hub) => hub.key === activeHubKey) ?? null
    : null;
  const activeHubProjectCount = activeHubKey
    ? (hubProjectIdsRef.current.get(activeHubKey) ?? []).filter(
        (id) => !visibleIds || visibleIds.includes(id),
      ).length
    : 0;

  // Recomputes arc filter + opacity from the current activeHub + visibleIds
  const applyArcs = () => {
    const map = mapRef.current;
    if (!map?.getLayer('project-arcs-line')) return;
    const activeHub = activeHubRef.current;
    const ids = visibleIdsRef.current;
    const visible = ids ? new Set(ids) : null;

    if (activeHub) {
      const hubIds = hubProjectIdsRef.current.get(activeHub) ?? [];
      const filteredIds = visible ? hubIds.filter((id) => visible.has(id)) : hubIds;
      map.setFilter('project-arcs-line', ['in', ['get', 'project'], ['literal', filteredIds]]);
      map.setPaintProperty('project-arcs-line', 'line-opacity', 0.65);
      map.setPaintProperty('project-arcs-line', 'line-width', 1.6);
      map.setPaintProperty('project-arcs-line', 'line-color', '#6691c0');
    } else {
      map.setFilter(
        'project-arcs-line',
        visible ? ['in', ['get', 'project'], ['literal', [...visible]]] : null,
      );
      map.setPaintProperty('project-arcs-line', 'line-opacity', 0.3);
      map.setPaintProperty('project-arcs-line', 'line-width', 1.2);
      map.setPaintProperty('project-arcs-line', 'line-color', '#4472a8');
    }
  };

  // Hub focus: context markers + polygon layers dim/brighten based on activeHub
  const applyHubFocus = () => {
    const map = mapRef.current;
    const activeHub = activeHubRef.current;
    markersRef.current.forEach(({ hubKey, originKey, el }) => {
      if (originKey) {
        el.classList.toggle('is-active', originKey === activeHub);
        el.classList.toggle('is-muted', !!activeHub && originKey !== activeHub);
        return;
      }
      // Dim by default; only reveal when the matching hub is explicitly selected
      const focused = !!activeHub && hubKey === activeHub;
      // Use filter instead of opacity — MapLibre overwrites inline opacity on every _update
      el.classList.toggle('is-active', focused);
      el.classList.toggle('is-muted', !focused);
    });
    polygonLayersRef.current.forEach(({ hubKey, layerIds }) => {
      const focused = !!activeHub && hubKey === activeHub;
      layerIds.forEach((layerId) => {
        if (!map?.getLayer(layerId)) return;
        if (layerId.endsWith('-fill')) {
          map.setPaintProperty(layerId, 'fill-opacity', focused ? 0.15 : 0);
        } else {
          map.setPaintProperty(layerId, 'line-opacity', focused ? 0.6 : 0);
        }
      });
    });
    applyArcs();
  };

  // Visibility filter from search: controls display:none + reapplies arcs
  const applyVisibility = () => {
    const map = mapRef.current;
    const ids = visibleIdsRef.current;
    const visible = ids ? new Set(ids) : null;
    const isAnyVisible = (projectIds: string[]) =>
      !visible || projectIds.some((id) => visible.has(id));
    markersRef.current.forEach(({ projectIds, el }) => {
      el.style.display = isAnyVisible(projectIds) ? '' : 'none';
    });
    polygonLayersRef.current.forEach(({ projectId, layerIds }) => {
      layerIds.forEach((layerId) => {
        if (map?.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            'visibility',
            isAnyVisible([projectId]) ? 'visible' : 'none',
          );
        }
      });
    });
    const activeHub = activeHubRef.current;
    if (activeHub) {
      const activeIds = hubProjectIdsRef.current.get(activeHub) ?? [];
      if (!isAnyVisible(activeIds)) {
        activeHubRef.current = null;
        setActiveHubKey(null);
        applyHubFocus();
      }
    }
    applyArcs();
  };

  const setHubFocus = (hubKey: string | null, fit = true) => {
    activeHubRef.current = hubKey;
    setActiveHubKey(hubKey);
    applyHubFocus();
    if (!fit) return;
    if (hubKey) fitHubRef.current(hubKey);
    else fitVisibleRef.current();
  };

  const toggleHubFocus = (hubKey: string) => {
    setHubFocus(activeHubRef.current === hubKey ? null : hubKey);
  };

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;
    setMapReady(false);

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [40, 40],
        zoom: 1.6,
        renderWorldCopies: false,
        attributionControl: false,
      });
      mapRef.current = map;
      markersRef.current = [];
      polygonLayersRef.current = [];
      activeHubRef.current = null;
      hubProjectIdsRef.current = new Map();
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
        'top-left',
      );
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('mousemove', (event) => {
        if (coordinateReadoutRef.current) {
          coordinateReadoutRef.current.textContent = formatCoordinates(
            event.lngLat.lat,
            event.lngLat.lng,
          );
        }
      });
      map.on('mouseout', () => {
        if (coordinateReadoutRef.current) {
          coordinateReadoutRef.current.textContent = 'Move across the map';
        }
      });

      const bounds: LngLatBounds = new maplibregl.LngLatBounds();

      let overlaysInitialized = false;
      const initializeProjectOverlays = () => {
        if (!map || cancelled || overlaysInitialized) return;
        overlaysInitialized = true;
        const arcFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

        // ── Fixed hub cities — always shown regardless of project data ──
        const originGroups = new Map<
          string,
          { lat: number; lng: number; label: string; projects: Project[] }
        >(
          HUBS.map((hub) => [hub.key, { lat: hub.lat, lng: hub.lng, label: hub.label, projects: [] }])
        );

        // Assign each project with an origin to its nearest hub
        const contextGroups = new Map<string, ContextPoint[]>();

        projects.forEach((project) => {
          const { origin } = project.geography;
          if (!origin) return;
          const hub = nearestHub(origin.lat, origin.lng);
          originGroups.get(hub.key)!.projects.push(project);
        });

        // Build hubProjectIds lookup (used for arc filtering)
        originGroups.forEach((group, key) => {
          hubProjectIdsRef.current.set(key, group.projects.map((p) => p.id));
        });

        const fitProjectIds = (projectIds: string[], includeOrigins = true) => {
          if (!map) return;
          const visible = visibleIdsRef.current ? new Set(visibleIdsRef.current) : null;
          const projectIdSet = new Set(projectIds);
          const fitBounds = new maplibregl.LngLatBounds();

          projects.forEach((project) => {
            if (!projectIdSet.has(project.id) || (visible && !visible.has(project.id))) return;
            if (includeOrigins && project.geography.origin) {
              const hub = nearestHub(project.geography.origin.lat, project.geography.origin.lng);
              fitBounds.extend([hub.lng, hub.lat]);
            }
            project.geography.contexts.forEach((context) => {
              const target = contextTarget(context);
              if (target) fitBounds.extend(target);
            });
          });

          if (!fitBounds.isEmpty()) {
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            map.fitBounds(fitBounds, {
              padding: expanded ? 96 : 56,
              maxZoom: 6,
              duration: reducedMotion ? 0 : 650,
            });
          }
        };

        fitVisibleRef.current = () => fitProjectIds(projects.map((project) => project.id));
        fitHubRef.current = (hubKey) =>
          fitProjectIds(hubProjectIdsRef.current.get(hubKey) ?? []);

        // ── One origin marker per hub city ─────────────────────────────
        originGroups.forEach((group, hubKey) => {
          if (group.projects.length === 0) return;
          const lngLat: [number, number] = [group.lng, group.lat];
          bounds.extend(lngLat);

          const originEl = document.createElement('button');
          originEl.type = 'button';
          originEl.className = `map-origin-marker map-origin-marker--${hubKey}`;
          originEl.title = group.label;
          originEl.setAttribute(
            'aria-label',
            `${group.label}, ${group.projects.length} ${group.projects.length === 1 ? 'project' : 'projects'} created here`,
          );

          const name = document.createElement('span');
          name.className = 'map-origin-name';
          name.textContent = group.label.split(',')[0];
          originEl.append(name);

          if (group.projects.length > 1) {
            const badge = document.createElement('span');
            badge.className = 'map-origin-badge';
            badge.textContent = String(group.projects.length);
            originEl.append(badge);
          }

          const marker = new maplibregl.Marker({ element: originEl }).setLngLat(lngLat);

          originEl.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleHubFocus(hubKey);
          });
          const popup = new maplibregl.Popup({ offset: 18, maxWidth: '260px' }).setDOMContent(
            buildProjectListPopup(
              group.projects,
              {
                eyebrow: 'Created in',
                label: group.label,
                lat: group.lat,
                lng: group.lng,
              },
              (slug) => navigateRef.current(`/works/${slug}`),
            ),
          );
          marker.setPopup(popup);

          marker.addTo(map!);
          markersRef.current.push({
            projectIds: group.projects.map((p) => p.id),
            el: originEl,
            hubKey: null,
            originKey: hubKey,
          });
        });

        // ── Arcs + context markers (per project) ───────────────────────
        projects.forEach((project) => {
          const { origin, contexts } = project.geography;
          if (!origin) return;
          const hub = nearestHub(origin.lat, origin.lng);
          const originLngLat: [number, number] = [hub.lng, hub.lat];

          contexts.forEach((context, index) => {
            const target = contextTarget(context);
            if (!target) return;
            bounds.extend(target);

            arcFeatures.push({
              type: 'Feature',
              properties: { project: project.id },
              geometry: { type: 'LineString', coordinates: arcCoords(originLngLat, target) },
            });

            if (context.connectionType === 'point') {
              const groupKey = `${hub.key}:${target[0].toFixed(4)}:${target[1].toFixed(4)}`;
              const entries = contextGroups.get(groupKey) ?? [];
              entries.push({
                project,
                label: context.label,
                lat: target[1],
                lng: target[0],
                hubKey: hub.key,
              });
              contextGroups.set(groupKey, entries);
            } else if (context.geojsonUrl) {
              const sourceId = `polygon-${project.id}-${index}`;
              fetch(context.geojsonUrl)
                .then((res) => res.json())
                .then((geojson: GeoJSON.GeoJSON) => {
                  if (!map || cancelled || map.getSource(sourceId)) return;
                  map.addSource(sourceId, { type: 'geojson', data: geojson });
                  // Polygons start hidden until their hub is selected
                  map.addLayer({
                    id: `${sourceId}-fill`,
                    type: 'fill',
                    source: sourceId,
                    paint: { 'fill-color': '#4472a8', 'fill-opacity': 0 },
                  });
                  map.addLayer({
                    id: `${sourceId}-line`,
                    type: 'line',
                    source: sourceId,
                    paint: {
                      'line-color': '#6691c0',
                      'line-opacity': 0,
                      'line-width': 1,
                    },
                  });
                  polygonLayersRef.current.push({
                    projectId: project.id,
                    hubKey: hub.key,
                    layerIds: [`${sourceId}-fill`, `${sourceId}-line`],
                  });
                  map.on('mouseenter', `${sourceId}-fill`, () => {
                    if (map) map.getCanvas().style.cursor = 'pointer';
                  });
                  map.on('mouseleave', `${sourceId}-fill`, () => {
                    if (map) map.getCanvas().style.cursor = '';
                  });
                  applyVisibility();
                  applyHubFocus();
                })
                .catch(() => {});
            }
          });
        });

        contextGroups.forEach((entries) => {
          const first = entries[0];
          const projectsAtPoint = Array.from(
            new Map(entries.map((entry) => [entry.project.id, entry.project])).values(),
          );
          const labels = Array.from(new Set(entries.map((entry) => entry.label)));
          const locationLabel = labels.length === 1
            ? labels[0]
            : `${labels[0]} + ${labels.length - 1} related ${labels.length === 2 ? 'context' : 'contexts'}`;
          const contextEl = document.createElement('button');
          contextEl.type = 'button';
          contextEl.className = 'map-context-marker is-muted';
          contextEl.title = locationLabel;
          contextEl.setAttribute(
            'aria-label',
            `${locationLabel}, ${projectsAtPoint.length} ${projectsAtPoint.length === 1 ? 'project' : 'projects'} mapped here`,
          );

          if (projectsAtPoint.length > 1) {
            const badge = document.createElement('span');
            badge.className = 'map-context-badge';
            badge.textContent = String(projectsAtPoint.length);
            contextEl.append(badge);
          }

          const contextPopup = new maplibregl.Popup({
            offset: 16,
            maxWidth: '260px',
          }).setDOMContent(
            buildProjectListPopup(
              projectsAtPoint,
              {
                eyebrow: 'Mapped place',
                label: locationLabel,
                lat: first.lat,
                lng: first.lng,
              },
              (slug) => navigateRef.current(`/works/${slug}`),
            ),
          );

          new maplibregl.Marker({ element: contextEl })
            .setLngLat([first.lng, first.lat])
            .setPopup(contextPopup)
            .addTo(map!);
          markersRef.current.push({
            projectIds: projectsAtPoint.map((project) => project.id),
            el: contextEl,
            hubKey: first.hubKey,
          });
        });

        map.addSource('project-arcs', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: arcFeatures },
        });
        map.addLayer({
          id: 'project-arcs-line',
          type: 'line',
          source: 'project-arcs',
          paint: {
            'line-color': '#4472a8',
            'line-opacity': 0.3,
            'line-width': 1.2,
            'line-dasharray': [2, 2],
          },
        });

        applyVisibility();
        applyHubFocus();

        if (!bounds.isEmpty()) {
          const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          map.fitBounds(bounds, {
            padding: expanded ? 96 : 64,
            maxZoom: 5,
            duration: reducedMotion ? 0 : 800,
          });
        }
        setMapReady(true);
      };

      // `styledata` lets the portfolio layer remain usable if the remote
      // basemap is slow or unavailable; `load` is retained as a safe fallback.
      map.on('styledata', initializeProjectOverlays);
      map.on('load', initializeProjectOverlays);

      // Click on polygon region → focus its hub
      map.on('click', (e) => {
        if (!map) return;
        const fillLayerIds = polygonLayersRef.current
          .flatMap((p) => p.layerIds)
          .filter((id) => id.endsWith('-fill') && map!.getLayer(id));
        const features = fillLayerIds.length
          ? map.queryRenderedFeatures(e.point, { layers: fillLayerIds })
          : [];
        if (features.length > 0) {
          const layerId = features[0].layer.id;
          const entry = polygonLayersRef.current.find((p) => p.layerIds.includes(layerId));
          if (entry) {
            const project = projects.find((pr) => pr.id === entry.projectId);
            const nextHub = activeHubRef.current === entry.hubKey ? null : entry.hubKey;
            setHubFocus(nextHub);
            const polygonContext = project?.geography.contexts.find(
              (context) => context.connectionType === 'polygon',
            );
            const target = polygonContext ? contextTarget(polygonContext) : null;
            if (nextHub && project && polygonContext && target) {
              new maplibregl.Popup({ offset: 8, maxWidth: '260px' })
                .setLngLat(e.lngLat)
                .setDOMContent(
                  buildPopupCard(
                    project,
                    () => navigateRef.current(`/works/${project.slug}`),
                    {
                      eyebrow: 'Mapped region',
                      label: polygonContext.label,
                      lat: target[1],
                      lng: target[0],
                    },
                  ),
                )
                .addTo(map!);
            }
            return;
          }
        }
        // Background click: deselect hub
        if (activeHubRef.current) {
          setHubFocus(null, false);
        }
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
      mapRef.current = null;
      markersRef.current = [];
      polygonLayersRef.current = [];
      fitVisibleRef.current = () => {};
      fitHubRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  useEffect(() => {
    applyVisibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds]);

  useEffect(() => {
    const timer = setTimeout(() => mapRef.current?.resize(), 60);
    return () => clearTimeout(timer);
  }, [expanded]);

  return (
    <div className={`relative min-w-0 overflow-hidden ${expanded ? 'h-full w-full' : 'rounded-[var(--radius-lg)]'}`}>
      <div
        ref={containerRef}
        role="application"
        aria-label="Interactive map of where portfolio projects were created and the places they map"
        aria-describedby="works-map-instructions"
        className={
          expanded
            ? 'h-full w-full'
            : 'h-[420px] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] md:h-[600px]'
        }
      />

      <div
        id="works-map-instructions"
        aria-live="polite"
        className="pointer-events-none absolute right-[var(--space-3)] top-[4.25rem] z-[var(--z-raised)] max-w-none rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[rgba(var(--color-chrome-rgb),0.9)] px-[var(--space-3)] py-[var(--space-2)] backdrop-blur-md max-sm:left-[var(--space-3)] sm:right-auto sm:top-[var(--space-3)] sm:left-14 sm:max-w-96"
      >
        <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] text-[var(--color-accent-light)] uppercase">
          Project geography
        </p>
        {activeHub ? (
          <>
            <p className="mt-1 text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
              {activeHub.label}
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[var(--color-text-secondary)]">
              {activeHubProjectCount} {activeHubProjectCount === 1 ? 'work' : 'works'} · mapped places highlighted
            </p>
          </>
        ) : (
          <>
            {/* <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[var(--color-text-secondary)]">
              {visibleStats.projectCount} works · {visibleStats.hubCount} creation hubs · {visibleStats.placeCount} mapped places
            </p> */}
            <p className="mt-0.5 hidden text-[11px] leading-relaxed text-[var(--color-text-muted)] sm:block">
              Choose a blue city to trace its projects.
            </p>
          </>
        )}
      </div>

      <div
        aria-label="Map legend"
        className="pointer-events-none absolute bottom-10 left-[var(--space-3)] z-[var(--z-raised)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[rgba(var(--color-chrome-rgb),0.9)] px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.06em] text-[var(--color-text-secondary)] backdrop-blur-md"
      >
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-accent-light)] shadow-[0_0_6px_var(--color-accent-light)]" />
          <span>Created in</span>
        </div>
        <div className="mt-1.5 flex items-center gap-[var(--space-2)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent-gold)] shadow-[0_0_4px_var(--color-accent-gold)]" />
          <span>Mapped place</span>
        </div>
        <div className="mt-[var(--space-2)] border-t border-[var(--color-border-subtle)] pt-[var(--space-2)] text-[9px] text-[var(--color-text-muted)]">
          <span ref={coordinateReadoutRef}>Move across the map</span>
        </div>
      </div>

      <div className="absolute right-[var(--space-3)] top-[var(--space-3)] z-[var(--z-raised)] flex gap-[var(--space-2)]">
        <button
          type="button"
          aria-label="Reset map to all visible projects"
          title="Show all visible projects"
          disabled={!mapReady}
          onClick={() => {
            setHubFocus(null, false);
            fitVisibleRef.current();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[rgba(var(--color-chrome-rgb),0.9)] text-[var(--color-text-secondary)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-wait disabled:opacity-50"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>

        {onToggleExpand && (
          <button
            type="button"
            aria-label={expanded ? 'Exit fullscreen' : 'Expand map to fullscreen'}
            title={expanded ? 'Exit fullscreen (Esc)' : 'Expand map'}
            onClick={onToggleExpand}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[rgba(var(--color-chrome-rgb),0.9)] text-[var(--color-text-secondary)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            {expanded ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 4v5H4" />
                <path d="M15 4v5h5" />
                <path d="M9 20v-5H4" />
                <path d="M15 20v-5h5" />
              </svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9V4h5" />
                <path d="M20 9V4h-5" />
                <path d="M4 15v5h5" />
                <path d="M20 15v5h-5" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
