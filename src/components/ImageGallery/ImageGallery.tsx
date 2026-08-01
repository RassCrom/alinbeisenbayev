import { useState } from 'react';
import type { GalleryImage } from '../../types';
import Lightbox, { isVideoUrl } from './Lightbox';

export interface ImageGalleryProps {
  images: GalleryImage[];
  /** Kept for backward compatibility — all images now support zoom/pan. */
  zoomable?: boolean;
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <figure key={`${image.url}-${index}`} className="flex flex-col">
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
                  className="aspect-video w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <img
                  src={image.url}
                  alt={image.caption || `Gallery image ${index + 1}`}
                  width={1200}
                  height={630}
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
        ))}
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
