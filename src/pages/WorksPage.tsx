import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import WorkCard from '../components/WorkCard/WorkCard';
import SearchFilter from '../components/SearchFilter/SearchFilter';
import { useProjectFilter } from '../hooks/useProjectFilter';
import projectsData from '../data/projects.json';
import type { ProjectsData } from '../types';

// MapLibre bundle loads only when the map view is opened
const WorksMap = lazy(() => import('../components/WorksMap/WorksMap'));

const { projects } = projectsData as ProjectsData;

type ViewMode = 'grid' | 'map';

export default function WorksPage() {
  const [view, setView] = useState<ViewMode>('grid');
  const [mapExpanded, setMapExpanded] = useState(false);
  // ?q= lets other pages (e.g. Skills) deep-link into a pre-filtered list
  const [searchParams] = useSearchParams();
  const { search, setSearch, selected, toggleKeyword, keywords, filtered } =
    useProjectFilter(projects, searchParams.get('q') ?? '');

  const visibleIds = useMemo(() => filtered.map((p) => p.id), [filtered]);

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
    setView(mode);
    if (mode === 'grid') setMapExpanded(false);
  };

  const toggleClass = (active: boolean) =>
    `flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border transition-colors ${
      active
        ? 'border-[var(--color-accent)] bg-[var(--color-accent-glow)] text-[var(--color-accent-light)]'
        : 'border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
    }`;

  return (
    <div className="mx-auto max-w-6xl px-[var(--space-6)] py-[var(--space-12)]">
      <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
        Works
      </h1>

      {/* Controls row (hidden while the fullscreen map shows its own sidebar) */}
      {!mapExpanded && (
        <div className="mt-[var(--space-6)] py-[var(--space-4)]">
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
                  year={Number(project.endDate.slice(0, 4))}
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
            {mapExpanded && (
              <aside
                key="sidebar"
                className="max-h-[45%] shrink-0 overflow-y-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-[var(--space-6)] md:h-full md:max-h-none md:w-80 md:border-b-0 md:border-r"
              >
                <h2 className="mono-label">Search &amp; Filters</h2>
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
                        className="block rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-2)] transition-colors hover:bg-[var(--color-bg-elevated)]"
                      >
                        <span className="font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] font-semibold">
                          {project.title}
                        </span>
                        <span className="ml-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                          {project.endDate.slice(0, 4)}
                        </span>
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
                  projects={projects}
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
