import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MapLegend from '../../components/WorksMap/MapLegend';
import WorksMap from '../../components/WorksMap/WorksMap';
import { projectYear } from '../../utils/date';
import type { Project } from '../../types';

/*
 * The works map: where each work was made and what it maps.
 *
 * Moved here from WorksPage so MapLibre (about 1 MB of script) loads only
 * when a visitor chooses the map; WorksPage imports this file lazily.
 *
 * LEGACY STYLING: this view still uses the old utility classes and is not on
 * the redesigned-files list. It is restyled with the map itself in plan 5.
 */

function contextCoordinates(project: Project): [number, number] | null {
  const context = project.geography.contexts[0];
  if (!context) return null;
  if (context.connectionType === 'polygon') {
    return context.centroidLat !== undefined && context.centroidLng !== undefined
      ? [context.centroidLat, context.centroidLng]
      : null;
  }
  return context.lat !== undefined && context.lng !== undefined ? [context.lat, context.lng] : null;
}

function compactCoordinates(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}

export interface WorksMapViewProps {
  /** Every listed project: the map draws them all and dims the ones filtered out. */
  all: Project[];
  /** The projects the page's filters currently let through. */
  visible: Project[];
}

export default function WorksMapView({ all, visible }: WorksMapViewProps) {
  const [mapExpanded, setMapExpanded] = useState(false);
  /** Project hovered in the sidebar or on the map; both light up together. */
  const [linkedId, setLinkedId] = useState<string | null>(null);

  const visibleIds = useMemo(() => visible.map((project) => project.id), [visible]);
  /** Highest per-city project count: the top of the graduated symbol scale. */
  const busiestHub = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((project) => {
      const label = project.geography.origin?.label;
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Math.max(1, ...counts.values());
  }, [all]);
  const geographyStats = useMemo(() => {
    const creationCities = new Set(visible.map((project) => project.geography.origin?.label).filter(Boolean));
    const mappedPlaces = new Set(
      visible.flatMap((project) =>
        project.geography.contexts.map((context) => {
          const coordinates =
            context.connectionType === 'polygon'
              ? [context.centroidLat, context.centroidLng]
              : [context.lat, context.lng];
          return coordinates.every((value) => value !== undefined)
            ? `${coordinates[0]}:${coordinates[1]}`
            : context.label;
        }),
      ),
    );
    return { creationCities: creationCities.size, mappedPlaces: mappedPlaces.size };
  }, [visible]);

  // Fullscreen map: Esc closes, body scroll locked while open
  useEffect(() => {
    if (!mapExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mapExpanded]);

  return (
    <div
      className={
        mapExpanded ? 'fixed inset-0 z-[var(--z-modal)] flex flex-col bg-[var(--color-bg-base)] md:flex-row' : ''
      }
    >
      {!mapExpanded && (
        <div className="mb-[var(--space-4)] flex flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] px-[var(--space-4)] py-[var(--space-3)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">
              Where the work was made, and what each project maps
            </p>
            <div className="mt-[var(--space-3)]">
              <MapLegend busiestHub={busiestHub} />
            </div>
          </div>
          <p className="shrink-0 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            {geographyStats.creationCities} hubs · {geographyStats.mappedPlaces} places
          </p>
        </div>
      )}

      {mapExpanded && (
        <aside
          key="sidebar"
          className="max-h-[45%] shrink-0 overflow-y-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-[var(--space-6)] md:h-full md:max-h-none md:w-80 md:border-b-0 md:border-r"
        >
          <h2 className="text-[length:var(--text-lg)] font-semibold">Project map</h2>
          <div className="mt-[var(--space-4)]">
            <MapLegend busiestHub={busiestHub} />
          </div>
          <p className="mt-[var(--space-6)] text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            {visible.length} {visible.length === 1 ? 'work' : 'works'} shown
          </p>
          <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-1)]">
            {visible.map((project) => (
              <li key={project.id}>
                <Link
                  to={`/works/${project.slug}`}
                  onMouseEnter={() => setLinkedId(project.id)}
                  onMouseLeave={() => setLinkedId(null)}
                  onFocus={() => setLinkedId(project.id)}
                  onBlur={() => setLinkedId(null)}
                  className={`map-list-row block min-h-11 rounded-[var(--radius-sm)] border border-transparent px-[var(--space-2)] py-[var(--space-2)] transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                    linkedId === project.id ? 'is-linked' : ''
                  }`}
                >
                  <span className="text-[length:var(--text-sm)] font-semibold">{project.title}</span>
                  <span className="ml-[var(--space-2)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {projectYear(project.endDate) ?? (project.endDate ? 'now' : '')}
                  </span>
                  {project.geography.contexts[0] && contextCoordinates(project) ? (
                    <span className="mt-1 block text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                      Maps {project.geography.contexts[0].label}
                      {project.geography.contexts.length > 1 ? ` +${project.geography.contexts.length - 1}` : ''}
                      {' · '}
                      {compactCoordinates(contextCoordinates(project)![0], contextCoordinates(project)![1])}
                    </span>
                  ) : project.geography.origin ? (
                    <span className="mt-1 block text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                      Created in {project.geography.origin.label}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div key="map" className={mapExpanded ? 'relative min-h-0 flex-1' : ''}>
        <WorksMap
          projects={all}
          visibleIds={visibleIds}
          expanded={mapExpanded}
          onToggleExpand={() => setMapExpanded((v) => !v)}
          linkedId={linkedId}
          onLinkedChange={setLinkedId}
        />
      </div>
    </div>
  );
}
