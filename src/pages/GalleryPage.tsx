import { useEffect } from 'react';
import GalleryMosaic from '../components/GalleryMosaic/GalleryMosaic';
import { galleryItems } from '../data/gallery';
import { usePageMeta } from '../hooks/usePageMeta';

const stills = galleryItems.filter((item) => item.kind === 'image').length;
const motion = galleryItems.length - stills;

export default function GalleryPage() {
  usePageMeta(
    'Gallery',
    'Finished maps, posters and map animations — the visuals on their own, without the case studies.',
  );

  // The film-grain overlay (global.css, body::before) is tuned for text pages;
  // over a wall of dense imagery it reads as heavier, so it's dimmed here.
  useEffect(() => {
    document.documentElement.classList.add('is-gallery-page');
    return () => document.documentElement.classList.remove('is-gallery-page');
  }, []);

  return (
    <div className="mx-auto max-w-[1680px] px-[var(--space-4)] py-[var(--space-12)] sm:px-[var(--space-6)]">
      <header className="mb-[var(--space-8)] flex flex-wrap items-baseline justify-between gap-[var(--space-4)]">
        <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold">
          Gallery
        </h1>
        <p className="mono-label">
          {stills} images · {motion} animations
        </p>
      </header>

      {galleryItems.length === 0 ? (
        <p className="py-[var(--space-16)] text-center text-[var(--color-text-muted)]">
          Nothing here yet.
        </p>
      ) : (
        <GalleryMosaic items={galleryItems} />
      )}
    </div>
  );
}
