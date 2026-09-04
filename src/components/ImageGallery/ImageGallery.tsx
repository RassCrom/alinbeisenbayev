import { useState } from 'react';
import type { GalleryImage } from '../../types';
import Lightbox, { isVideoUrl } from './Lightbox';

export type GalleryLayout = 'grid' | 'showcase';

export interface ImageGalleryProps {
  images: GalleryImage[];
  /**
   * Both layouts render every image at its own aspect ratio now — most of
   * this site's maps are portrait or panoramic, and a forced 16:9 crop was
   * cutting real composition off the top/bottom or the sides. What still
   * differs between the two:
   *
   * `grid` — sits under a written case study, inside the "Visuals / Gallery"
   * section heading, with the tighter of the two gaps.
   *
   * `showcase` — the images *are* the page (no written narrative to sit
   * under), so it runs full width with more breathing room and eager-loads
   * the first image.
   */
  layout?: GalleryLayout;
  /** Kept for backward compatibility — all images now support zoom/pan. */
  zoomable?: boolean;
}

/** Column count for the masonry, chosen so no image sits alone in a row. */
function masonryColumns(count: number): string {
  if (count <= 1) return '';
  if (count <= 3) return 'sm:columns-2';
  return 'sm:columns-2 lg:columns-3';
}

export default function ImageGallery({ images, layout = 'grid' }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const showcase = layout === 'showcase';
  const single = images.length === 1;

  const containerClass = `${showcase ? 'gap-[var(--space-8)]' : 'gap-[var(--space-6)]'} ${masonryColumns(images.length)}`;

  return (
    <>
      <div className={containerClass}>
        {images.map((image, index) => {
          const ratio = image.width && image.height ? image.width / image.height : null;

          // Sized to its own ratio when known; a 16:9 crop is the fallback for
          // the rare gallery entry that doesn't carry recorded dimensions.
          const mediaClass = ratio
            ? 'w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.02]'
            : 'aspect-video w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.02]';
          const mediaStyle = ratio ? { aspectRatio: String(ratio) } : undefined;

          return (
            <figure
              key={`${image.url}-${index}`}
              className="mb-[var(--space-6)] flex break-inside-avoid flex-col last:mb-0"
              // A lone image is capped by height rather than width, so a tall
              // portrait map doesn't run off the bottom of the viewport.
              style={single && ratio ? { maxWidth: `calc(78vh * ${ratio})`, margin: '0 auto' } : undefined}
            >
              <button
                type="button"
                aria-label={`Open ${image.caption || `image ${index + 1}`} in full-screen viewer`}
                className="group relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]"
                onClick={() => setLightboxIndex(index)}
              >
                {isVideoUrl(image.url) ? (
                  <video
                    src={image.url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className={mediaClass}
                    style={mediaStyle}
                  />
                ) : (
                  <img
                    src={image.url}
                    alt={image.caption || `Gallery image ${index + 1}`}
                    width={image.width ?? 1200}
                    height={image.height ?? 630}
                    loading={showcase && index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className={mediaClass}
                    style={mediaStyle}
                  />
                )}
                {/* Expand affordance — the custom cursor hides the native zoom-in cursor */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-[var(--space-2)] top-[var(--space-2)] flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[rgba(var(--color-chrome-rgb),0.8)] text-[var(--color-text-secondary)] opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </span>
              </button>
              <div className="mt-[var(--space-2)] flex items-start justify-between gap-[var(--space-3)]">
                {image.caption && (
                  <figcaption className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {image.caption}
                  </figcaption>
                )}
                {!image.url.includes('placeholder') && (
                  <a
                    href={image.downloadUrl ?? image.url}
                    download
                    aria-label="Download high-resolution image"
                    className="ml-auto shrink-0 font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-light)] opacity-70 transition-opacity hover:opacity-100"
                  >
                    ↓ hi-res
                  </a>
                )}
              </div>
            </figure>
          );
        })}
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
