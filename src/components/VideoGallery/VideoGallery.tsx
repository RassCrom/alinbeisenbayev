import { useCallback, useState } from 'react';
import type { VideoItem } from '../../types';

export interface VideoGalleryProps {
  videos: VideoItem[];
}

/**
 * Poster-first video grid. Nothing but the poster image is fetched on page load —
 * the <video> element is mounted only once the viewer presses play, and only one
 * clip is ever mounted at a time, so a page with a dozen clips costs one clip of
 * bandwidth at most.
 */
export default function VideoGallery({ videos }: VideoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const play = useCallback((index: number) => {
    setActiveIndex((current) => (current === index ? current : index));
  }, []);

  return (
    <div className="grid grid-cols-2 gap-[var(--space-4)] sm:grid-cols-3 lg:grid-cols-4">
      {videos.map((video, index) => {
        const isActive = activeIndex === index;
        return (
          <figure key={video.url} className="flex flex-col">
            <div
              className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]"
              style={{ aspectRatio: `${video.width} / ${video.height}` }}
            >
              {isActive ? (
                <video
                  src={video.url}
                  poster={video.poster}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  preload="none"
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => play(index)}
                  aria-label={`Play ${video.caption}`}
                  className="group h-full w-full"
                >
                  <img
                    src={video.poster}
                    alt={video.caption}
                    width={video.width}
                    height={video.height}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(13,19,32,0.78)] text-[var(--color-text-primary)] transition-transform duration-200 group-hover:scale-110">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </button>
              )}
            </div>
            {video.caption && (
              <figcaption className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {video.caption}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}
