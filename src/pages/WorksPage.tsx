import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import WorkCard from '../components/WorkCard/WorkCard';
import SearchFilter from '../components/SearchFilter/SearchFilter';
import { useProjectFilter } from '../hooks/useProjectFilter';
import { projects } from '../data/projects';
import { usePageMeta } from '../hooks/usePageMeta';

// MapLibre bundle loads only when the map view is opened
const WorksMap = lazy(() => import('../components/WorksMap/WorksMap'));

type ViewMode = 'grid' | 'map';
type TypeFilter = 'all' | 'web' | 'image' | 'animation';

function dateSortValue(date: string | null): number {
  if (date === 'Present') return Number.POSITIVE_INFINITY;
  if (!date) return Number.NEGATIVE_INFINITY;

  const [year, month = '12'] = date.split('-');
  return Number(year) * 12 + Number(month);
}

function contextCoordinates(project: (typeof projects)[number]): [number, number] | null {
  const context = project.geography.contexts[0];
  if (!context) return null;
  if (context.connectionType === 'polygon') {
    return context.centroidLat !== undefined && context.centroidLng !== undefined
      ? [context.centroidLat, context.centroidLng]
      : null;
  }
  return context.lat !== undefined && context.lng !== undefined
    ? [context.lat, context.lng]
    : null;
}

function compactCoordinates(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}

/**
 * Grid order, in three tiers:
 *
 *   1. finished before in-progress — pure newest-first opened the grid on three
 *      unfinished sketches, which is the worst available first impression;
 *   2. the curated `featuredOrder` run, so the strongest case studies lead here
 *      the same way they lead the landing page;
 *   3. recency, then title.
 *
 * Nothing is hidden — unfinished work still appears, just below the finished
 * work.
 */
function unfinishedRank(project: (typeof projects)[number]): number {
  return project.status === 'in-progress' ? 1 : 0;
}

/** MAX_SAFE_INTEGER rather than Infinity: two uncurated projects must subtract
 *  to 0 so the comparison falls through to the date tiers. Infinity would give
 *  NaN, which only works here because NaN happens to be falsy. */
function curatedRank(project: (typeof projects)[number]): number {
  return project.featuredOrder ?? Number.MAX_SAFE_INTEGER;
}

const sortedProjects = [...projects].sort(
  (a, b) =>
    unfinishedRank(a) - unfinishedRank(b) ||
    curatedRank(a) - curatedRank(b) ||
    dateSortValue(b.startDate) - dateSortValue(a.startDate) ||
    dateSortValue(b.endDate) - dateSortValue(a.endDate) ||
    a.title.localeCompare(b.title),
);

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'web', label: 'Web' },
  { key: 'image', label: 'Map' },
  { key: 'animation', label: 'Animation' },
];

const TYPE_FILTER_COUNTS: Record<TypeFilter, number> = {
  all: sortedProjects.length,
  web: sortedProjects.filter((project) => project.type !== 'static-map' && project.type !== 'animation').length,
  image: sortedProjects.filter((project) => project.type === 'static-map').length,
  animation: sortedProjects.filter((project) => project.type === 'animation').length,
};

export default function WorksPage() {
  usePageMeta('Works', 'Selected cartography, geospatial and interactive map projects — filterable by keyword, and mapped by where each was made and what it maps.');
  // Keep the map view shareable without discarding an existing search query.
  const [searchParams, setSearchParams] = useSearchParams();
  const view: ViewMode = searchParams.get('view') === 'map' ? 'map' : 'grid';
  const [mapExpanded, setMapExpanded] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const typeFiltered = useMemo(() => {
    if (typeFilter === 'web') return sortedProjects.filter((p) => p.type !== 'static-map' && p.type !== 'animation');
    if (typeFilter === 'image') return sortedProjects.filter((p) => p.type === 'static-map');
    if (typeFilter === 'animation') return sortedProjects.filter((p) => p.type === 'animation');
    return sortedProjects;
  }, [typeFilter]);

  const { search, setSearch, selected, toggleKeyword, keywords, filtered } =
    useProjectFilter(typeFiltered, searchParams.get('q') ?? '');

  const visibleIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const geographyStats = useMemo(() => {
    const creationCities = new Set(
      filtered.map((project) => project.geography.origin?.label).filter(Boolean),
    );
    const mappedPlaces = new Set(
      filtered.flatMap((project) =>
        project.geography.contexts.map((context) => {
          const coordinates = context.connectionType === 'polygon'
            ? [context.centroidLat, context.centroidLng]
            : [context.lat, context.lng];
          return coordinates.every((value) => value !== undefined)
            ? `${coordinates[0]}:${coordinates[1]}`
            : context.label;
        }),
      ),
    );
    return { creationCities: creationCities.size, mappedPlaces: mappedPlaces.size };
  }, [filtered]);

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

  const switchView = (mode: ViewMode) => {
    const nextParams = new URLSearchParams(searchParams);
    if (mode === 'map') nextParams.set('view', 'map');
    else nextParams.delete('view');
    setSearchParams(nextParams, { replace: true });
    if (mode === 'grid') setMapExpanded(false);
  };

  const toggleClass = (active: boolean) =>
    `flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
      active
        ? 'border-[var(--color-accent)] bg-[var(--color-accent-glow)] text-[var(--color-accent-light)]'
        : 'border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
    }`;

  return (
    <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-12)]">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
        Works
      </h1>

      {/* Type filter tabs */}
      {!mapExpanded && (
        <div className="mt-[var(--space-6)] flex gap-[var(--space-6)] border-b border-[var(--color-border-subtle)]">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`-mb-px flex min-h-11 items-center border-b-2 border-transparent px-0 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                typeFilter === key
                  ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {label} ({TYPE_FILTER_COUNTS[key]})
            </button>
          ))}
        </div>
      )}

      {/* Controls row (hidden while the fullscreen map shows its own sidebar) */}
      {!mapExpanded && (
        <div className="mt-[var(--space-4)] py-[var(--space-2)]">
          <div className="flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between">
            <SearchFilter
              keywords={keywords}
              search={search}
              selected={selected}
              onSearch={setSearch}
              onFilter={toggleKeyword}
            />
            <div className="flex shrink-0 gap-[var(--space-2)]">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                onClick={() => switchView('grid')}
                className={toggleClass(view === 'grid')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Map view"
                aria-pressed={view === 'map'}
                onClick={() => switchView('map')}
                className={toggleClass(view === 'map')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
                  <path d="M9 4v14" />
                  <path d="M15 6v14" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-[var(--space-8)]">
        {view === 'grid' ? (
          filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <WorkCard
                  key={project.id}
                  id={project.id}
                  slug={project.slug}
                  title={project.title}
                  year={project.endDate ? Number(project.endDate.slice(0, 4)) || null : null}
                  category={project.category}
                  tagline={project.tagline}
                  coverImage={project.coverImage}
                  award={project.awards[0]}
                  featured={project.featured}
                  status={project.status}
                  type={project.type}
                />
              ))}
            </div>
          ) : (
            <p className="py-[var(--space-16)] text-center text-[var(--color-text-muted)]">
              No works match the current filters.
            </p>
          )
        ) : (
          <div
            className={
              mapExpanded
                ? 'fixed inset-0 z-[var(--z-modal)] flex flex-col bg-[var(--color-bg-base)] md:flex-row'
                : ''
            }
          >
            {/* Search & filter sidebar — fullscreen mode only */}
            {!mapExpanded && (
              <div className="mb-[var(--space-4)] flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-[var(--space-4)] py-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
                    Where the work was made, and what each project maps
                  </p>
                  <p className="mt-1 max-w-2xl text-[length:var(--text-xs)] leading-relaxed text-[var(--color-text-muted)]">
                    Blue cities are creation hubs. Gold points and regions are the geographic subjects connected to those works.
                  </p>
                </div>
                <p className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] text-[var(--color-text-secondary)] uppercase">
                  {geographyStats.creationCities} hubs · {geographyStats.mappedPlaces} places
                </p>
              </div>
            )}

            {mapExpanded && (
              <aside
                key="sidebar"
                className="max-h-[45%] shrink-0 overflow-y-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-[var(--space-6)] md:h-full md:max-h-none md:w-80 md:border-b-0 md:border-r"
              >
                <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--text-lg)] font-bold">
                  Project map
                </h2>
                <p className="mt-1 text-[length:var(--text-xs)] leading-relaxed text-[var(--color-text-muted)]">
                  Filter the portfolio, then explore where each work was created and the places it maps.
                </p>
                <p className="mono-label mt-[var(--space-6)]">Search &amp; Filters</p>
                <div className="mt-[var(--space-4)]">
                  <SearchFilter
                    keywords={keywords}
                    search={search}
                    selected={selected}
                    onSearch={setSearch}
                    onFilter={toggleKeyword}
                  />
                </div>
                <p className="mono-label mt-[var(--space-6)]">
                  {filtered.length} {filtered.length === 1 ? 'work' : 'works'} shown
                </p>
                <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-1)]">
                  {filtered.map((project) => (
                    <li key={project.id}>
                      <Link
                        to={`/works/${project.slug}`}
                        className="block min-h-11 rounded-[var(--radius-sm)] border border-transparent px-[var(--space-2)] py-[var(--space-2)] transition-colors hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                      >
                        <span className="font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] font-semibold">
                          {project.title}
                        </span>
                        <span className="ml-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                          {project.endDate?.slice(0, 4) ?? '—'}
                        </span>
                        {project.geography.contexts[0] && contextCoordinates(project) ? (
                          <span className="mt-1 block font-[family-name:var(--font-mono)] text-[9px] leading-relaxed tracking-[0.04em] text-[var(--color-text-muted)]">
                            Maps {project.geography.contexts[0].label}
                            {project.geography.contexts.length > 1
                              ? ` +${project.geography.contexts.length - 1}`
                              : ''}
                            {' · '}
                            {compactCoordinates(
                              contextCoordinates(project)![0],
                              contextCoordinates(project)![1],
                            )}
                          </span>
                        ) : project.geography.origin ? (
                          <span className="mt-1 block font-[family-name:var(--font-mono)] text-[9px] leading-relaxed tracking-[0.04em] text-[var(--color-text-muted)]">
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
              <Suspense
                fallback={
                  <div className="flex h-[420px] items-center justify-center md:h-[600px]">
                    <span className="mono-label">Loading map…</span>
                  </div>
                }
              >
                <WorksMap
                  projects={sortedProjects}
                  visibleIds={visibleIds}
                  expanded={mapExpanded}
                  onToggleExpand={() => setMapExpanded((v) => !v)}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
