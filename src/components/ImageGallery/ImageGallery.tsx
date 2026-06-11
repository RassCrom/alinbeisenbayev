import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryImage } from '../../types';

export interface ImageGalleryProps {
  images: GalleryImage[];
  /** Kept for backward compatibility — all images now support zoom/pan. */
  zoomable?: boolean;
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const capturedPointerId = useRef<number | null>(null);
  // Keep a mutable snapshot of transform so the wheel DOM listener (non-passive) avoids stale closures
  const transformRef = useRef({ scale: 1, panX: 0, panY: 0 });
  transformRef.current = { scale, panX, panY };

  const resetTransform = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    resetTransform();
  }, [resetTransform]);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    if (lightboxIndex === null) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxIndex]);

  // Reset zoom/pan when switching images
  useEffect(() => {
    resetTransform();
  }, [lightboxIndex, resetTransform]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeLightbox(); return; }
      if (e.key === 'ArrowRight')
        setLightboxIndex((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
      if (e.key === '+' || e.key === '=')
        setScale((s) => Math.min(8, +(s * 1.4).toFixed(3)));
      if (e.key === '-')
        setScale((s) => Math.max(1, +(s / 1.4).toFixed(3)));
      if (e.key === '0') resetTransform();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, images.length, closeLightbox, resetTransform]);

  // Non-passive wheel listener for zoom-to-cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container || lightboxIndex === null) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { scale, panX, panY } = transformRef.current;
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      const newScale = Math.max(1, Math.min(8, scale * factor));
      const f = newScale / scale;
      setScale(newScale);
      setPanX(cx + (panX - cx) * f);
      setPanY(cy + (panY - cy) * f);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [lightboxIndex]);

  // Pointer drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (scale <= 1) return;
    if (capturedPointerId.current !== null) return;
    capturedPointerId.current = e.pointerId;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX, panY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [scale, panX, panY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (capturedPointerId.current !== e.pointerId) return;
    setPanX(dragStart.current.panX + (e.clientX - dragStart.current.x));
    setPanY(dragStart.current.panY + (e.clientY - dragStart.current.y));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (capturedPointerId.current === e.pointerId) {
      capturedPointerId.current = null;
      setIsDragging(false);
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetTransform();
    } else {
      setScale(2.5);
    }
  }, [scale, resetTransform]);

  const navigate = useCallback((dir: 1 | -1) => {
    resetTransform();
    setLightboxIndex((i) => (i === null ? i : (i + dir + images.length) % images.length));
  }, [images.length, resetTransform]);

  const active = lightboxIndex !== null ? images[lightboxIndex] : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2">
        {images.map((image, index) => (
          <figure key={`${image.url}-${index}`} className="flex flex-col">
            <button
              type="button"
              className="w-full"
              onClick={() => setLightboxIndex(index)}
            >
              <img
                src={image.url}
                alt={image.caption || `Gallery image ${index + 1}`}
                width={1200}
                height={630}
                loading="lazy"
                decoding="async"
                className="aspect-video w-full cursor-zoom-in rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] object-cover transition-opacity hover:opacity-90"
              />
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
                  onClick={(e) => e.stopPropagation()}
                >
                  ↓ hi-res
                </a>
              )}
            </div>
          </figure>
        ))}
      </div>

      {/* Full-screen lightbox with pan + zoom */}
      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[rgba(10,15,26,0.97)]"
          onClick={closeLightbox}
        >
          {/* Zoomable image container */}
          <div
            ref={containerRef}
            className="flex h-full w-full cursor-zoom-in items-center justify-center overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
          >
            <img
              src={active.url}
              alt={active.caption || 'Gallery image'}
              draggable={false}
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                maxHeight: '88vh',
                maxWidth: '92vw',
                width: 'auto',
                userSelect: 'none',
                touchAction: 'none',
              }}
            />
          </div>

          {/* Caption */}
          {active.caption && (
            <div
              className="pointer-events-none absolute bottom-[var(--space-10)] left-1/2 -translate-x-1/2 px-[var(--space-6)] text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-body)] text-[length:var(--text-sm)] italic text-[var(--color-text-secondary)]">
                {active.caption}
              </span>
            </div>
          )}

          {/* Hint */}
          <div className="pointer-events-none absolute bottom-[var(--space-3)] left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)] opacity-40">
              scroll to zoom · drag to pan · double-click to reset
            </span>
          </div>

          {/* Toolbar: zoom controls + download + close */}
          <div
            className="absolute right-[var(--space-4)] top-[var(--space-4)] flex items-center gap-[var(--space-1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setScale((s) => Math.max(1, +(s / 1.4).toFixed(3)))}
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] text-[length:var(--text-lg)] leading-none text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              −
            </button>
            {scale !== 1 && (
              <button
                type="button"
                aria-label="Reset zoom"
                onClick={resetTransform}
                className="flex h-9 min-w-[3rem] items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] px-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                {Math.round(scale * 100)}%
              </button>
            )}
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setScale((s) => Math.min(8, +(s * 1.4).toFixed(3)))}
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] text-[length:var(--text-lg)] leading-none text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              +
            </button>
            <a
              href={active.downloadUrl ?? active.url}
              download
              aria-label="Download image"
              className="ml-[var(--space-1)] flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
            <button
              type="button"
              aria-label="Close"
              onClick={closeLightbox}
              className="ml-[var(--space-1)] flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] text-[length:var(--text-xl)] leading-none text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              ×
            </button>
          </div>

          {/* Prev / Next */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                className="absolute left-[var(--space-3)] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] text-[length:var(--text-2xl)] leading-none text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => { e.stopPropagation(); navigate(1); }}
                className="absolute right-[var(--space-3)] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(13,19,32,0.85)] text-[length:var(--text-2xl)] leading-none text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
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
