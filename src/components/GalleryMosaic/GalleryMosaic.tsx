import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Lightbox from '../ImageGallery/Lightbox';
import { gallerySrcSet } from '../../data/gallery';
import type { GalleryImage, GalleryItem } from '../../types';

interface Placed {
  item: GalleryItem;
  index: number;
  width: number;
  height: number;
  /** Share of the row's leftover pixels; 0 on the unfilled last row. */
  grow: number;
  /** Position within its row, for the reveal stagger. */
  column: number;
}

/**
 * Target row heights, cycled row by row. A tall row followed by a short one is
 * what keeps the wall from reading as a uniform contact sheet.
 */
function rhythmFor(width: number): number[] {
  if (width >= 1200) return [460, 290, 380, 250];
  if (width >= 768) return [360, 230, 300];
  return [250, 160, 210];
}

/**
 * Justified rows: each row is scaled so its tiles, at their own aspect ratio,
 * exactly fill the width — nothing is cropped. A row closes at whichever
 * break lands its height nearer the rhythm's target.
 */
export function layoutMosaic(items: GalleryItem[], width: number, gap: number): Placed[] {
  const rhythm = rhythmFor(width);
  const placed: Placed[] = [];
  let row: { item: GalleryItem; index: number; ratio: number }[] = [];
  let rowIndex = 0;

  const heightFor = (ratios: number) => (count: number) => (width - gap * (count - 1)) / ratios;
  const flush = (height: number, full: boolean) => {
    row.forEach(({ item, index, ratio }, column) =>
      placed.push({ item, index, width: ratio * height, height, grow: full ? ratio : 0, column }),
    );
    row = [];
    rowIndex += 1;
  };

  items.forEach((item, index) => {
    const ratio = item.width / item.height;
    const target = rhythm[rowIndex % rhythm.length];
    const sum = row.reduce((s, r) => s + r.ratio, 0);
    const withNext = heightFor(sum + ratio)(row.length + 1);
    if (withNext > target) {
      row.push({ item, index, ratio });
      return;
    }
    // Adding this tile would push the row below target: keep it only if that
    // lands closer to the target than closing the row without it.
    const without = row.length ? heightFor(sum)(row.length) : Infinity;
    if (Math.abs(withNext - target) <= Math.abs(without - target)) {
      row.push({ item, index, ratio });
      flush(withNext, true);
    } else {
      flush(without, true);
      row.push({ item, index, ratio });
    }
  });
  if (row.length) {
    const target = rhythm[rowIndex % rhythm.length];
    const sum = row.reduce((s, r) => s + r.ratio, 0);
    const fill = heightFor(sum)(row.length);
    flush(Math.min(target, fill), fill <= target);
  }
  return placed;
}

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

interface TileProps {
  tile: Placed;
  canHover: boolean;
  reduceMotion: boolean;
  onOpen: (index: number) => void;
}

function Tile({ tile, canHover, reduceMotion, onOpen }: TileProps) {
  const { item, index } = tile;
  const isVideo = item.kind === 'video';
  const ref = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [videoMounted, setVideoMounted] = useState(false);

  // On a mouse the loop plays on hover; on touch, while the tile is mostly on screen.
  const playing = isVideo && (canHover ? hovered : !reduceMotion && inView);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setRevealed(true);
        setInView(entry.intersectionRatio >= 0.6);
      },
      { threshold: [0, 0.6], rootMargin: '0px 0px -6% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The loop is only fetched the first time it is asked to play.
  useEffect(() => {
    if (playing) setVideoMounted(true);
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing, videoMounted]);

  const number = String(index + 1).padStart(2, '0');

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={item.series ? `${item.title}, ${item.series}` : item.title}
      className={`gallery-tile ${revealed ? 'is-visible' : ''}`}
      style={
        {
          flex: `${tile.grow} 1 ${Math.floor(tile.width)}px`,
          height: tile.height,
          '--reveal-delay': `${tile.column * 70}ms`,
        } as React.CSSProperties
      }
    >
      <img
        src={isVideo ? item.poster : item.src}
        srcSet={gallerySrcSet(item)}
        sizes={`${Math.ceil(tile.width)}px`}
        width={item.width}
        height={item.height}
        alt=""
        loading={index < 6 ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
      {videoMounted && item.preview && (
        <video
          ref={videoRef}
          src={item.preview}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          className={playing ? 'is-playing' : ''}
        />
      )}
      <span className="gallery-tile__caption" aria-hidden="true">
        <span className="gallery-tile__meta">
          {number}
          {item.series && ` · ${item.series}`}
        </span>
        <span className="gallery-tile__title">{item.title}</span>
      </span>
    </button>
  );
}

export interface GalleryMosaicProps {
  items: GalleryItem[];
}

/**
 * Every finished visual as one wall. Only the work shows; the title slides in
 * on hover (or keyboard focus), and a click opens the shared lightbox.
 */
export default function GalleryMosaic({ items }: GalleryMosaicProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const canHover = useMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gap = width >= 768 ? 10 : 6;
  const tiles = useMemo(() => (width ? layoutMosaic(items, width, gap) : []), [items, width, gap]);

  const slides = useMemo<GalleryImage[]>(
    () =>
      items.map((item) => ({
        url: item.src,
        caption: item.series ? `${item.title} — ${item.series}` : item.title,
        type: item.kind,
        width: item.width,
        height: item.height,
        poster: item.poster,
      })),
    [items],
  );

  return (
    <>
      <div
        ref={ref}
        className="gallery-mosaic"
        style={{ '--gallery-gap': `${gap}px` } as React.CSSProperties}
      >
        {tiles.map((tile) => (
          <Tile
            key={tile.item.id}
            tile={tile}
            canHover={canHover}
            reduceMotion={reduceMotion}
            onOpen={setOpenIndex}
          />
        ))}
      </div>
      {openIndex !== null && (
        <Lightbox
          images={slides}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
