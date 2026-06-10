import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl';
import type { Project } from '../../types';
import 'maplibre-gl/dist/maplibre-gl.css';

// Custom basemap matching the site tokens (CARTO vector tiles, no API key)
const MAP_STYLE = '/map-styles/portfolio-dark.json';

export interface WorksMapProps {
  projects: Project[];
  /** Project ids currently matching search/filters; markers outside it are hidden. */
  visibleIds?: string[];
  /** Fullscreen mode: fills its parent instead of the fixed-height card. */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/** Curved arc between two lng/lat points (quadratic bezier, perpendicular offset). */
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

export default function WorksMap({
  projects,
  visibleIds,
  expanded = false,
  onToggleExpand,
}: WorksMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<{ projectId: string; el: HTMLElement }[]>([]);
  const polygonLayersRef = useRef<{ projectId: string; layerIds: string[] }[]>([]);
  const visibleIdsRef = useRef<string[] | undefined>(visibleIds);
  visibleIdsRef.current = visibleIds;
  const selectedRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Clicking a marker highlights everything belonging to its project and
  // fades the rest; clicking the basemap (or the marker again) clears it.
  const applyHighlight = () => {
    const map = mapRef.current;
    const selected = selectedRef.current;
    markersRef.current.forEach(({ projectId, el }) => {
      el.style.opacity = selected && projectId !== selected ? '0.2' : '1';
    });
    if (map?.getLayer('project-arcs-line')) {
      map.setPaintProperty(
        'project-arcs-line',
        'line-opacity',
        selected ? ['case', ['==', ['get', 'project'], selected], 0.9, 0.06] : 0.55,
      );
      map.setPaintProperty(
        'project-arcs-line',
        'line-color',
        selected ? ['case', ['==', ['get', 'project'], selected], '#6691c0', '#4472a8'] : '#4472a8',
      );
      map.setPaintProperty(
        'project-arcs-line',
        'line-width',
        selected ? ['case', ['==', ['get', 'project'], selected], 2.2, 1] : 1.4,
      );
    }
    polygonLayersRef.current.forEach(({ projectId, layerIds }) => {
      const dimmed = Boolean(selected) && projectId !== selected;
      layerIds.forEach((layerId) => {
        if (!map?.getLayer(layerId)) return;
        if (layerId.endsWith('-fill')) {
          map.setPaintProperty(layerId, 'fill-opacity', dimmed ? 0.03 : 0.15);
        } else {
          map.setPaintProperty(layerId, 'line-opacity', dimmed ? 0.08 : 0.6);
        }
      });
    });
  };

  const toggleSelection = (projectId: string) => {
    selectedRef.current = selectedRef.current === projectId ? null : projectId;
    applyHighlight();
  };

  const applyVisibility = () => {
    const map = mapRef.current;
    const ids = visibleIdsRef.current;
    const visible = ids ? new Set(ids) : null;
    const isVisible = (projectId: string) => !visible || visible.has(projectId);
    markersRef.current.forEach(({ projectId, el }) => {
      el.style.display = isVisible(projectId) ? '' : 'none';
    });
    if (map?.getLayer('project-arcs-line')) {
      map.setFilter(
        'project-arcs-line',
        visible ? ['in', ['get', 'project'], ['literal', [...visible]]] : null,
      );
    }
    polygonLayersRef.current.forEach(({ projectId, layerIds }) => {
      layerIds.forEach((layerId) => {
        if (map?.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', isVisible(projectId) ? 'visible' : 'none');
        }
      });
    });
  };

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;

    (async () => {
      // maplibre-gl is heavy — load it only when the map view is shown
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
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      const bounds: LngLatBounds = new maplibregl.LngLatBounds();

      map.on('load', () => {
        if (!map || cancelled) return;
        const arcFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

        projects.forEach((project) => {
          const { origin, contexts } = project.geography;
          const originLngLat: [number, number] = [origin.lng, origin.lat];
          bounds.extend(originLngLat);

          // Origin: pulsing dot with project card popup
          const originEl = document.createElement('div');
          originEl.className = 'map-origin-marker';
          originEl.title = `${project.title} — ${origin.label}`;
          originEl.addEventListener('click', (e) => {
            e.stopPropagation(); // keep the basemap click handler from clearing it
            toggleSelection(project.id);
          });
          const popup = new maplibregl.Popup({ offset: 14, maxWidth: '240px' }).setDOMContent(
            buildPopupCard(project, () => navigateRef.current(`/works/${project.slug}`)),
          );
          new maplibregl.Marker({ element: originEl })
            .setLngLat(originLngLat)
            .setPopup(popup)
            .addTo(map!);
          markersRef.current.push({ projectId: project.id, el: originEl });

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

            // Arc from origin → context (multiple projects fan out from shared origins)
            arcFeatures.push({
              type: 'Feature',
              properties: { project: project.id },
              geometry: { type: 'LineString', coordinates: arcCoords(originLngLat, target) },
            });

            if (context.connectionType === 'point') {
              const contextEl = document.createElement('div');
              contextEl.className = 'map-context-marker';
              contextEl.title = context.label;
              contextEl.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelection(project.id);
              });
              const contextPopup = new maplibregl.Popup({ offset: 10, maxWidth: '240px' }).setDOMContent(
                buildPopupCard(project, () => navigateRef.current(`/works/${project.slug}`)),
              );
              new maplibregl.Marker({ element: contextEl })
                .setLngLat(target)
                .setPopup(contextPopup)
                .addTo(map!);
              markersRef.current.push({ projectId: project.id, el: contextEl });
            } else if (context.geojsonUrl) {
              const sourceId = `polygon-${project.id}-${index}`;
              fetch(context.geojsonUrl)
                .then((res) => res.json())
                .then((geojson: GeoJSON.GeoJSON) => {
                  if (!map || cancelled || map.getSource(sourceId)) return;
                  map.addSource(sourceId, { type: 'geojson', data: geojson });
                  map.addLayer({
                    id: `${sourceId}-fill`,
                    type: 'fill',
                    source: sourceId,
                    paint: { 'fill-color': '#4472a8', 'fill-opacity': 0.15 },
                  });
                  map.addLayer({
                    id: `${sourceId}-line`,
                    type: 'line',
                    source: sourceId,
                    paint: { 'line-color': '#6691c0', 'line-opacity': 0.6, 'line-width': 1 },
                  });
                  polygonLayersRef.current.push({
                    projectId: project.id,
                    layerIds: [`${sourceId}-fill`, `${sourceId}-line`],
                  });
                  map.on('mouseenter', `${sourceId}-fill`, () => {
                    if (map) map.getCanvas().style.cursor = 'pointer';
                  });
                  map.on('mouseleave', `${sourceId}-fill`, () => {
                    if (map) map.getCanvas().style.cursor = '';
                  });
                  applyVisibility();
                  applyHighlight();
                })
                .catch(() => {
                  /* placeholder geojson may be missing — non-fatal */
                });
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
            'line-opacity': 0.55,
            'line-width': 1.4,
            'line-dasharray': [2, 2],
          },
        });

        applyVisibility();
        applyHighlight();

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 64, maxZoom: 5, duration: 800 });
        }
      });

      // Clicks: a polygon feature selects its project (with popup, like the
      // markers); a bare basemap click clears the highlight.
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
          const project = entry ? projects.find((pr) => pr.id === entry.projectId) : undefined;
          if (project) {
            const wasSelected = selectedRef.current === project.id;
            toggleSelection(project.id);
            if (!wasSelected) {
              new maplibregl.Popup({ offset: 8, maxWidth: '240px' })
                .setLngLat(e.lngLat)
                .setDOMContent(
                  buildPopupCard(project, () => navigateRef.current(`/works/${project.slug}`)),
                )
                .addTo(map!);
            }
            return;
          }
        }
        if (selectedRef.current) {
          selectedRef.current = null;
          applyHighlight();
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

  // Re-apply when search/filter selection changes
  useEffect(() => {
    applyVisibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds]);

  // The canvas must be re-measured when toggling fullscreen
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
      {onToggleExpand && (
        <button
          type="button"
          aria-label={expanded ? 'Exit fullscreen' : 'Expand map to fullscreen'}
          title={expanded ? 'Exit fullscreen (Esc)' : 'Expand map'}
          onClick={onToggleExpand}
          className="absolute right-[var(--space-3)] top-[var(--space-3)] z-[var(--z-raised)] flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[rgba(13,19,32,0.85)] text-[var(--color-text-secondary)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
        >
          {expanded ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4v5H4" />
              <path d="M15 4v5h5" />
              <path d="M9 20v-5H4" />
              <path d="M15 20v-5h5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
