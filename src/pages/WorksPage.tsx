import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/Button/Button';
import FilterChip from '../components/FilterChip/FilterChip';
import Icon from '../components/Icon/Icon';
import Lightbox from '../components/ImageGallery/Lightbox';
import PieceCard from '../components/PieceCard/PieceCard';
import Skeleton from '../components/Skeleton/Skeleton';
import WorkCard from '../components/WorkCard/WorkCard';
import { OFFERS, type OfferSlug } from '../data/offers';
import { projects } from '../data/projects';
import { distribute, filterEntries, parseOffer, workEntries, type WorkEntry } from '../data/works';
import { usePageMeta } from '../hooks/usePageMeta';
import type { GalleryImage, GalleryItem } from '../types';

// MapLibre is about 1 MB of script. It loads when the map is chosen, not before.
const WorksMapView = lazy(() => import('./works/WorksMapView'));

/** Cards added per step. Enough to fill a tall screen at three columns. */
const BATCH = 18;

const COLUMN_QUERIES = ['(min-width: 1024px)', '(min-width: 640px)'] as const;

/** One column on a phone, two on a tablet, three from 1024 px. */
function useColumns(): number {
  const read = () =>
    window.matchMedia(COLUMN_QUERIES[0]).matches ? 3 : window.matchMedia(COLUMN_QUERIES[1]).matches ? 2 : 1;
  const [columns, setColumns] = useState(read);
  useEffect(() => {
    const lists = COLUMN_QUERIES.map((query) => window.matchMedia(query));
    const onChange = () => setColumns(read());
    lists.forEach((list) => list.addEventListener('change', onChange));
    return () => lists.forEach((list) => list.removeEventListener('change', onChange));
  }, []);
  return columns;
}

const toSlide = (item: GalleryItem): GalleryImage => ({
  url: item.src,
  caption: item.title,
  type: item.kind,
  width: item.width,
  height: item.height,
  poster: item.poster,
});

const pieceItems = (entries: WorkEntry[]): GalleryItem[] =>
  entries.flatMap((entry) => (entry.kind === 'piece' ? [entry.item] : []));

const ALL_PIECES = pieceItems(workEntries);

export default function WorksPage() {
  usePageMeta(
    'Work',
    'Custom maps, spatial analysis, data visualization, data journalism and remote sensing work by Alikhan Beisenbayev.',
  );

  // Every filter lives in the address, so a filtered view can be shared and
  // Back returns to it.
  const [params, setParams] = useSearchParams();
  const offer = parseOffer(params.get('offer'));
  const query = params.get('q') ?? '';
  const view = params.get('view') === 'map' ? 'map' : 'grid';
  const openId = params.get('item');

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const visible = useMemo(() => filterEntries(workEntries, offer, query), [offer, query]);

  // Cards arrive in batches as the end of the grid nears. A new filter starts over.
  const [shown, setShown] = useState(BATCH);
  useEffect(() => setShown(BATCH), [offer, query]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const more = view === 'grid' && shown < visible.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!more || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + BATCH);
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [more, shown]);

  const columns = useColumns();
  const grid = useMemo(() => distribute(visible.slice(0, shown), columns), [visible, shown, columns]);

  // The lightbox steps through the pieces on screen; a piece opened by
  // address that the filters have hidden steps through all of them instead.
  const visiblePieces = useMemo(() => pieceItems(visible), [visible]);
  const slidesFrom = visiblePieces.some((item) => item.id === openId) ? visiblePieces : ALL_PIECES;
  const openIndex = openId ? slidesFrom.findIndex((item) => item.id === openId) : -1;
  const slides = useMemo(() => slidesFrom.map(toSlide), [slidesFrom]);

  const visibleProjects = useMemo(
    () => visible.flatMap((entry) => (entry.kind === 'project' ? [entry.project] : [])),
    [visible],
  );

  const chooseOffer = (slug: OfferSlug | null) => update({ offer: slug });

  return (
    <div className="works wrap">
      <h1 className="t-display works__title">Work</h1>

      <div className="works__filters" role="group" aria-label="Filter by offer">
        <FilterChip pressed={offer === null} onClick={() => chooseOffer(null)}>
          All
        </FilterChip>
        {OFFERS.map((item) => (
          <FilterChip key={item.slug} pressed={offer === item.slug} onClick={() => chooseOffer(item.slug)}>
            {item.label}
          </FilterChip>
        ))}
      </div>

      <div className="works__tools">
        <label className="search-field">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Search works"
            placeholder="Search"
            value={query}
            onChange={(event) => update({ q: event.target.value })}
          />
        </label>
        <div className="works__view" role="group" aria-label="View">
          <FilterChip pressed={view === 'grid'} onClick={() => update({ view: null })}>
            Grid
          </FilterChip>
          <FilterChip pressed={view === 'map'} onClick={() => update({ view: 'map' })}>
            Map
          </FilterChip>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="works__empty">
          <p>No works match.</p>
          <Button variant="quiet" icon="arrow-right" onClick={() => update({ offer: null, q: null })}>
            Clear filters
          </Button>
        </div>
      ) : view === 'map' ? (
        <div className="works__map">
          <Suspense fallback={<Skeleton className="works__map-skeleton" />}>
            <WorksMapView all={projects} visible={visibleProjects} />
          </Suspense>
        </div>
      ) : (
        <>
          <div className="works__grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {grid.map((column, index) => (
              <div key={index} className="works__column">
                {column.map((entry) => (
                  <div key={entry.id} className="works__cell">
                    {entry.kind === 'project' ? (
                      <WorkCard project={entry.project} />
                    ) : (
                      <PieceCard item={entry.item} onOpen={(item) => update({ item: item.id })} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {more && <div ref={sentinelRef} className="works__sentinel" aria-hidden="true" />}
        </>
      )}

      {openIndex >= 0 && (
        <Lightbox
          images={slides}
          index={openIndex}
          onIndexChange={(index) => update({ item: slidesFrom[index].id })}
          onClose={() => update({ item: null })}
        />
      )}
    </div>
  );
}
