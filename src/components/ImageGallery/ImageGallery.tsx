import { useEffect, useRef, useState } from 'react';
import mediumZoom from 'medium-zoom';
import type { GalleryImage } from '../../types';

export interface ImageGalleryProps {
  images: GalleryImage[];
  /** true for static-map projects: high-res zoom/pan via medium-zoom */
  zoomable?: boolean;
}

export default function ImageGallery({ images, zoomable = false }: ImageGalleryProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Zoomable mode: medium-zoom handles click-to-zoom with pan/pinch support.
  useEffect(() => {
    if (!zoomable || !gridRef.current) return;
    const zoom = mediumZoom(gridRef.current.querySelectorAll('img'), {
      background: 'rgba(13, 19, 32, 0.95)',
      margin: 16,
    });
    return () => {
      zoom.detach();
    };
  }, [zoomable, images]);

  // Custom lightbox keyboard controls.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, images.length]);

  const active = lightboxIndex !== null ? images[lightboxIndex] : null;

  return (
    <>
      <div ref={gridRef} className="grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2">
        {images.map((image, index) => (
          <figure key={`${image.url}-${index}`}>
            <img
              src={image.url}
              alt={image.caption || `Gallery image ${index + 1}`}
              width={1200}
              height={630}
              loading="lazy"
              onClick={zoomable ? undefined : () => setLightboxIndex(index)}
              className={`aspect-video w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] object-cover ${
                zoomable ? '' : 'cursor-zoom-in'
              }`}
            />
            {image.caption && (
              <figcaption className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {image.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {/* Custom lightbox (non-zoomable projects) */}
      {active && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[rgba(13,19,32,0.95)] p-[var(--space-6)]"
        >
          <figure
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full max-w-5xl flex-col items-center gap-[var(--space-4)]"
          >
            <img
              src={active.url}
              alt={active.caption || 'Gallery image'}
              className="max-h-[80vh] w-auto rounded-[var(--radius-md)] object-contain shadow-[var(--shadow-elevated)]"
            />
            {active.caption && (
              <figcaption className="text-center font-[family-name:var(--font-body)] text-[length:var(--text-sm)] italic text-[var(--color-text-secondary)]">
                {active.caption}
              </figcaption>
            )}
          </figure>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-[var(--space-6)] top-[var(--space-6)] text-[length:var(--text-3xl)] leading-none text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ×
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
                }}
                className="absolute left-[var(--space-4)] top-1/2 -translate-y-1/2 text-[length:var(--text-3xl)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i === null ? i : (i + 1) % images.length));
                }}
                className="absolute right-[var(--space-4)] top-1/2 -translate-y-1/2 text-[length:var(--text-3xl)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
