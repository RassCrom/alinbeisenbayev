import { useEffect, useRef } from 'react';
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

function nearestHub(lat: number, lng: number): Hub {
  return HUBS.reduce<Hub>((best, hub) => {
    const d = (hub.lat - lat) ** 2 + (hub.lng - lng) ** 2;
    const bd = (best.lat - lat) ** 2 + (best.lng - lng) ** 2;
    return d < bd ? hub : best;
  }, HUBS[0]);
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

function buildPopupCard(project: Project, onView: () => void): HTMLElement {
  const el = document.createElement('div');
  el.style.width = '220px';
  el.style.cursor = 'pointer';
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
  el.addEventListener('click', onView);
  return el;
}

function buildOriginPopup(
  projects: Project[],
  label: string,
  onNavigate: (slug: string) => void,
): HTMLElement {
  if (projects.length === 1) {
    return buildPopupCard(projects[0], () => onNavigate(projects[0].slug));
  }
  const el = document.createElement('div');
  el.style.width = '220px';
  const header = document.createElement('div');
  header.textContent = label;
  header.style.cssText =
    'padding:8px 12px 6px;font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;' +
    'color:var(--color-text-muted);text-transform:uppercase;' +
    'border-bottom:1px solid rgba(255,255,255,0.06);';
  el.append(header);
  projects.forEach((project) => {
    const item = document.createElement('div');
    item.style.cssText =
      'padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.15s;';
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(68,114,168,0.12)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = '';
    });
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
  // hubKey: null = origin/hub marker; string = the hub this context marker belongs to
  const markersRef = useRef<{ projectIds: string[]; el: HTMLElement; hubKey: string | null }[]>([]);
  const polygonLayersRef = useRef<{ projectId: string; hubKey: string; layerIds: string[] }[]>([]);
  const visibleIdsRef = useRef<string[] | undefined>(visibleIds);
  visibleIdsRef.current = visibleIds;
  const activeHubRef = useRef<string | null>(null);
  const hubProjectIdsRef = useRef(new Map<string, string[]>());
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

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
      map.setPaintProperty('project-arcs-line', 'line-opacity', 0.12);
      map.setPaintProperty('project-arcs-line', 'line-width', 1.2);
      map.setPaintProperty('project-arcs-line', 'line-color', '#4472a8');
    }
  };

  // Hub focus: context markers + polygon layers dim/brighten based on activeHub
  const applyHubFocus = () => {
    const map = mapRef.current;
    const activeHub = activeHubRef.current;
    markersRef.current.forEach(({ hubKey, el }) => {
      if (hubKey === null) return; // origin markers are always fully visible
      const focused = !activeHub || hubKey === activeHub;
      el.style.opacity = focused ? '1' : '0.3';
      el.style.transition = 'opacity 0.25s ease';
    });
    polygonLayersRef.current.forEach(({ hubKey, layerIds }) => {
      const focused = !activeHub || hubKey === activeHub;
      layerIds.forEach((layerId) => {
        if (!map?.getLayer(layerId)) return;
        if (layerId.endsWith('-fill')) {
          map.setPaintProperty(layerId, 'fill-opacity', focused ? 0.15 : 0.04);
        } else {
          map.setPaintProperty(layerId, 'line-opacity', focused ? 0.6 : 0.1);
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
      !visible || projectIds.length === 0 || projectIds.some((id) => visible.has(id));
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
    applyArcs();
  };

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [40, 40],
        zoom: 1.6,
        attributionControl: false,
      });
      mapRef.current = map;
      markersRef.current = [];
      polygonLayersRef.current = [];
      activeHubRef.current = null;
      hubProjectIdsRef.current = new Map();
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      const bounds: LngLatBounds = new maplibregl.LngLatBounds();

      map.on('load', () => {
        if (!map || cancelled) return;
        const arcFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

        // ── Fixed hub cities — always shown regardless of project data ──
        const originGroups = new Map<
          string,
          { lat: number; lng: number; label: string; projects: Project[] }
        >(
          HUBS.map((hub) => [hub.key, { lat: hub.lat, lng: hub.lng, label: hub.label, projects: [] }])
        );

        // Assign each project with an origin to its nearest hub
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

        // ── One origin marker per hub city ─────────────────────────────
        originGroups.forEach((group, hubKey) => {
          const lngLat: [number, number] = [group.lng, group.lat];
          bounds.extend(lngLat);

          const originEl = document.createElement('div');
          originEl.className = 'map-origin-marker';
          originEl.title = group.label;

          if (group.projects.length > 1) {
            const badge = document.createElement('span');
            badge.className = 'map-origin-badge';
            badge.textContent = String(group.projects.length);
            originEl.append(badge);
          }

          const marker = new maplibregl.Marker({ element: originEl }).setLngLat(lngLat);

          if (group.projects.length > 0) {
            originEl.addEventListener('click', (e) => {
              e.stopPropagation();
              activeHubRef.current = activeHubRef.current === hubKey ? null : hubKey;
              applyHubFocus();
            });
            const popup = new maplibregl.Popup({ offset: 14, maxWidth: '240px' }).setDOMContent(
              buildOriginPopup(group.projects, group.label, (slug) =>
                navigateRef.current(`/works/${slug}`),
              ),
            );
            marker.setPopup(popup);
          }

          marker.addTo(map!);
          markersRef.current.push({
            projectIds: group.projects.map((p) => p.id),
            el: originEl,
            hubKey: null,
          });
        });

        // ── Arcs + context markers (per project) ───────────────────────
        projects.forEach((project) => {
          const { origin, contexts } = project.geography;
          if (!origin) return;
          const hub = nearestHub(origin.lat, origin.lng);
          const originLngLat: [number, number] = [hub.lng, hub.lat];

          contexts.forEach((context, index) => {
            const target: [number, number] | null =
              context.connectionType === 'polygon'
                ? context.centroidLng !== undefined && context.centroidLat !== undefined
                  ? [context.centroidLng, context.centroidLat]
                  : null
                : context.lng !== undefined && context.lat !== undefined
                  ? [context.lng, context.lat]
                  : null;
            if (!target) return;
            bounds.extend(target);

            arcFeatures.push({
              type: 'Feature',
              properties: { project: project.id },
              geometry: { type: 'LineString', coordinates: arcCoords(originLngLat, target) },
            });

            if (context.connectionType === 'point') {
              const contextEl = document.createElement('div');
              contextEl.className = 'map-context-marker';
              contextEl.title = context.label;
              contextEl.style.opacity = '0.3';
              const contextPopup = new maplibregl.Popup({
                offset: 10,
                maxWidth: '240px',
              }).setDOMContent(
                buildPopupCard(project, () =>
                  navigateRef.current(`/works/${project.slug}`),
                ),
              );
              new maplibregl.Marker({ element: contextEl })
                .setLngLat(target)
                .setPopup(contextPopup)
                .addTo(map!);
              markersRef.current.push({ projectIds: [project.id], el: contextEl, hubKey: hub.key });
            } else if (context.geojsonUrl) {
              const sourceId = `polygon-${project.id}-${index}`;
              fetch(context.geojsonUrl)
                .then((res) => res.json())
                .then((geojson: GeoJSON.GeoJSON) => {
                  if (!map || cancelled || map.getSource(sourceId)) return;
                  map.addSource(sourceId, { type: 'geojson', data: geojson });
                  // Polygons start dimmed (hub not selected)
                  map.addLayer({
                    id: `${sourceId}-fill`,
                    type: 'fill',
                    source: sourceId,
                    paint: { 'fill-color': '#4472a8', 'fill-opacity': 0.04 },
                  });
                  map.addLayer({
                    id: `${sourceId}-line`,
                    type: 'line',
                    source: sourceId,
                    paint: {
                      'line-color': '#6691c0',
                      'line-opacity': 0.1,
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
            'line-opacity': 0.12,
            'line-width': 1.2,
            'line-dasharray': [2, 2],
          },
        });

        applyVisibility();
        applyHubFocus();

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 64, maxZoom: 5, duration: 800 });
        }
      });

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
            activeHubRef.current = activeHubRef.current === entry.hubKey ? null : entry.hubKey;
            applyHubFocus();
            if (activeHubRef.current && project) {
              new maplibregl.Popup({ offset: 8, maxWidth: '240px' })
                .setLngLat(e.lngLat)
                .setDOMContent(
                  buildPopupCard(project, () =>
                    navigateRef.current(`/works/${project.slug}`),
                  ),
                )
                .addTo(map!);
            }
            return;
          }
        }
        // Background click: deselect hub
        if (activeHubRef.current) {
          activeHubRef.current = null;
          applyHubFocus();
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
    <div className={`relative ${expanded ? 'h-full w-full' : ''}`}>
      <div
        ref={containerRef}
        className={
          expanded
            ? 'h-full w-full'
            : 'h-[420px] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] md:h-[600px]'
        }
      />

      {/* Map legend */}
      <div
        aria-label="Map legend"
        style={{
          position: 'absolute',
          bottom: '2.5rem',
          left: '0.75rem',
          zIndex: 10,
          background: 'rgba(13,19,32,0.88)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          backdropFilter: 'blur(8px)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.06em',
          color: 'var(--color-text-secondary)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.14em',
            marginBottom: '6px',
            color: 'var(--color-text-muted)',
            fontSize: '9px',
          }}
        >
          LEGEND
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--color-accent-light)',
              boxShadow: '0 0 6px var(--color-accent-light)',
              flexShrink: 0,
            }}
          />
          <span>Origin city</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-accent-gold)',
              boxShadow: '0 0 4px var(--color-accent-gold)',
              flexShrink: 0,
            }}
          />
          <span>Works</span>
        </div>
      </div>

      {onToggleExpand && (
        <button
          type="button"
          aria-label={expanded ? 'Exit fullscreen' : 'Expand map to fullscreen'}
          title={expanded ? 'Exit fullscreen (Esc)' : 'Expand map'}
          onClick={onToggleExpand}
          className="absolute right-[var(--space-3)] top-[var(--space-3)] z-[var(--z-raised)] flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[rgba(13,19,32,0.85)] text-[var(--color-text-secondary)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
        >
          {expanded ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 4v5H4" />
              <path d="M15 4v5h5" />
              <path d="M9 20v-5H4" />
              <path d="M15 20v-5h5" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 9V4h5" />
              <path d="M20 9V4h-5" />
              <path d="M4 15v5h5" />
              <path d="M20 15v5h-5" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
