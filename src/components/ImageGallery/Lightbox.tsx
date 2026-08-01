import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GalleryImage } from '../../types';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.4;
/** Pointer travel (px) above which a press counts as a drag, not a tap. */
const TAP_SLOP = 6;
/** Horizontal travel (px) that commits an unzoomed swipe to a navigation. */
const SWIPE_COMMIT = 60;

export const isVideoUrl = (url: string): boolean => /\.(webm|mp4)(\?.*)?$/i.test(url);

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

interface View {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: View = { scale: 1, x: 0, y: 0 };

export interface LightboxProps {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export default function Lightbox({ images, index, onIndexChange, onClose }: LightboxProps) {
  const active = images[index];
  const isVideo = isVideoUrl(active.url);
  const multiple = images.length > 1;

  const [view, setView] = useState<View>(IDENTITY);
  const [swipeDx, setSwipeDx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  /** Mirror of `view` for DOM listeners and gesture math that must not go stale. */
  const viewRef = useRef(view);
  viewRef.current = view;

  /** Live pointers, keyed by pointerId — 1 entry = drag/swipe, 2 = pinch. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** Snapshot taken when a gesture begins. */
  const gesture = useRef({
    startX: 0,
    startY: 0,
    startView: IDENTITY,
    pinchDist: 0,
    pinchMid: { x: 0, y: 0 },
    moved: false,
    pointerType: 'mouse',
    onMedia: false,
  });

  // ---- Transform helpers -------------------------------------------------

  /** Keep the media from being panned past its own edges. */
  const clampView = useCallback((next: View): View => {
    const media = mediaRef.current;
    const stage = stageRef.current;
    if (!media || !stage) return next;
    // offsetWidth/Height are the untransformed layout box, so they scale linearly.
    const maxX = Math.max(0, (media.offsetWidth * next.scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (media.offsetHeight * next.scale - stage.clientHeight) / 2);
    return { scale: next.scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  /** Zoom by `factor`, keeping the point under (clientX, clientY) fixed. */
  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const cx = clientX - (rect.left + rect.width / 2);
      const cy = clientY - (rect.top + rect.height / 2);
      setView((v) => {
        const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
        if (scale === v.scale) return v;
        const f = scale / v.scale;
        return clampView({ scale, x: cx + (v.x - cx) * f, y: cy + (v.y - cy) * f });
      });
    },
    [clampView],
  );

  /** Zoom around the stage centre — used by the toolbar and keyboard. */
  const zoomCentered = useCallback(
    (factor: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt],
  );

  const resetView = useCallback(() => setView(IDENTITY), []);

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (!multiple) return;
      onIndexChange((index + dir + images.length) % images.length);
    },
    [multiple, index, images.length, onIndexChange],
  );

  // ---- Lifecycle ---------------------------------------------------------

  // Reset per-image state whenever the shown media changes.
  useEffect(() => {
    setView(IDENTITY);
    setSwipeDx(0);
    setLoaded(false);
  }, [index]);

  // Lock the page behind the dialog without the scrollbar-removal layout jump.
  useEffect(() => {
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, []);

  // Move focus into the dialog and hand it back to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Keyboard: navigation, zoom, close, and a Tab trap inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          return;
        case 'ArrowRight':
          navigate(1);
          return;
        case 'ArrowLeft':
          navigate(-1);
          return;
        case '+':
        case '=':
          zoomCentered(ZOOM_STEP);
          return;
        case '-':
        case '_':
          zoomCentered(1 / ZOOM_STEP);
          return;
        case '0':
          resetView();
          return;
        case 'Tab': {
          const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled])',
          );
          if (!focusables?.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, zoomCentered, resetView, onClose]);

  // Wheel zoom needs a non-passive listener to be able to preventDefault.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || isVideo) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setShowHint(false);
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt, isVideo]);

  // Warm the neighbouring images so arrow/swipe navigation feels instant.
  useEffect(() => {
    if (!multiple) return;
    for (const dir of [1, -1]) {
      const next = images[(index + dir + images.length) % images.length];
      if (next && !isVideoUrl(next.url)) new Image().src = next.url;
    }
  }, [index, images, multiple]);

  // ---- Pointer gestures --------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    // Let the video's native controls handle their own pointers.
    if (isVideo) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (pointers.current.size === 1) {
      gesture.current = {
        ...gesture.current,
        startX: e.clientX,
        startY: e.clientY,
        startView: viewRef.current,
        moved: false,
        pointerType: e.pointerType,
        // Captured pointers retarget to the stage, so remember the real origin now.
        onMedia: e.target === mediaRef.current,
      };
      setIsDragging(true);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture.current.startView = viewRef.current;
      gesture.current.moved = true;
      setSwipeDx(0);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (!g.pinchDist) return;
      const target = clamp(g.startView.scale * (dist / g.pinchDist), MIN_SCALE, MAX_SCALE);
      const f = target / viewRef.current.scale;
      if (f !== 1) zoomAt(g.pinchMid.x, g.pinchMid.y, f);
      setShowHint(false);
      return;
    }

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
    if (!g.moved) return;
    setShowHint(false);

    if (g.startView.scale > 1) {
      setView(clampView({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy }));
    } else if (multiple && g.pointerType !== 'mouse') {
      // Unzoomed touch drag = swipe to navigate, with the media following the finger.
      // Mice are excluded so a stray drag can't skip an image.
      setSwipeDx(dx);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (pointers.current.size > 0) {
      // Second finger lifted mid-pinch — re-anchor the remaining one.
      const [remaining] = [...pointers.current.values()];
      gesture.current = {
        ...g,
        startX: remaining.x,
        startY: remaining.y,
        startView: viewRef.current,
        pinchDist: 0,
        moved: true,
      };
      return;
    }

    setIsDragging(false);
    const dx = e.clientX - g.startX;

    if (
      g.moved &&
      g.startView.scale <= 1 &&
      g.pointerType !== 'mouse' &&
      Math.abs(dx) > SWIPE_COMMIT
    ) {
      navigate(dx < 0 ? 1 : -1);
    }
    setSwipeDx(0);

    if (!g.moved) {
      // A tap on the media toggles zoom; a tap on the empty stage dismisses.
      if (g.onMedia) {
        setShowHint(false);
        if (viewRef.current.scale > 1) resetView();
        else zoomAt(e.clientX, e.clientY, 2.5);
      } else {
        onClose();
      }
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setIsDragging(false);
      setSwipeDx(0);
    }
  };

  // ---- Render ------------------------------------------------------------

  const zoomed = view.scale > 1;
  const swiping = swipeDx !== 0;
  const transform = `translate3d(${view.x + swipeDx}px, ${view.y}px, 0) scale(${view.scale})`;
  const mediaStyle: React.CSSProperties = {
    transform,
    transformOrigin: 'center center',
    transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
    maxHeight: '100%',
    maxWidth: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    opacity: swiping ? 1 - Math.min(0.5, Math.abs(swipeDx) / 400) : 1,
  };

  const btn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[rgba(var(--color-chrome-rgb),0.82)] text-[var(--color-text-secondary)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent-light)] hover:text-[var(--color-text-primary)]';

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={active.caption || 'Image viewer'}
      tabIndex={-1}
      className="lightbox fixed inset-0 z-[var(--z-modal)] flex flex-col outline-none"
    >
      {/* Backdrop — click-to-dismiss outside the stage band */}
      <div
        className="absolute inset-0 bg-[rgba(8,12,20,0.96)]"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Top bar: counter + toolbar */}
      <div className="relative flex shrink-0 items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-4)]">
        <span className="pointer-events-none font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] tabular-nums text-[var(--color-text-muted)]">
          {multiple && `${String(index + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`}
        </span>

        <div className="flex items-center gap-[var(--space-1)]">
          {!isVideo && (
            <>
              <button type="button" aria-label="Zoom out" className={btn} onClick={() => zoomCentered(1 / ZOOM_STEP)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                  <line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Reset zoom"
                className={`${btn} w-auto min-w-[3.25rem] px-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] tabular-nums ${zoomed ? 'text-[var(--color-accent-light)]' : 'opacity-50'}`}
                onClick={resetView}
                disabled={!zoomed}
              >
                {Math.round(view.scale * 100)}%
              </button>
              <button type="button" aria-label="Zoom in" className={btn} onClick={() => zoomCentered(ZOOM_STEP)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                  <line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
              </button>
            </>
          )}
          <a
            href={active.downloadUrl ?? active.url}
            download
            aria-label="Download high-resolution file"
            className={`${btn} ml-[var(--space-1)]`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
          <button type="button" aria-label="Close viewer" className={`${btn} ml-[var(--space-1)]`} onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>
      </div>

      {/* Media stage — flex-1 so it always claims exactly the space the
          top/bottom bars leave over. Pointer gestures live here, not on the
          dialog root, so setPointerCapture can never swallow a button click. */}
      <div
        ref={stageRef}
        className="lightbox-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-[var(--space-4)] sm:px-[4.5rem]"
        style={{ touchAction: 'none', cursor: zoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // Videos opt out of the gesture layer so their native controls work;
        // they still get click-outside-to-dismiss.
        onClick={(e) => {
          if (isVideo && e.target === stageRef.current) onClose();
        }}
      >
        {!loaded && !isVideo && (
          <span className="lightbox-spinner absolute" aria-hidden="true" />
        )}
        {isVideo ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            key={active.url}
            src={active.url}
            controls
            autoPlay
            loop
            muted
            playsInline
            style={{ ...mediaStyle, cursor: 'default' }}
          />
        ) : (
          <img
            ref={mediaRef as React.RefObject<HTMLImageElement>}
            key={active.url}
            src={active.url}
            alt={active.caption || `Gallery image ${index + 1}`}
            draggable={false}
            onLoad={() => setLoaded(true)}
            style={{
              ...mediaStyle,
              userSelect: 'none',
              opacity: loaded ? mediaStyle.opacity : 0,
              transition: isDragging
                ? 'none'
                : 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease',
            }}
          />
        )}
      </div>

      {/* Prev / Next — deliberately outside the stage so their clicks are not
          consumed by the stage's tap-to-dismiss handler. Touch uses swipe. */}
      {multiple && (
        <>
          <div className="absolute left-[var(--space-3)] top-1/2 hidden -translate-y-1/2 sm:block">
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => navigate(-1)}
              className={`${btn} h-11 w-11 text-[length:var(--text-2xl)] leading-none`}
            >
              ‹
            </button>
          </div>
          <div className="absolute right-[var(--space-3)] top-1/2 hidden -translate-y-1/2 sm:block">
            <button
              type="button"
              aria-label="Next image"
              onClick={() => navigate(1)}
              className={`${btn} h-11 w-11 text-[length:var(--text-2xl)] leading-none`}
            >
              ›
            </button>
          </div>
        </>
      )}

      {/* Caption + hint + thumbnails */}
      <div className="relative flex shrink-0 flex-col items-center gap-[var(--space-2)] px-[var(--space-4)] pb-[var(--space-3)]">
        {active.caption && (
          <p className="max-w-[60ch] text-center font-[family-name:var(--font-body)] text-[length:var(--text-sm)] italic text-[var(--color-text-secondary)]">
            {active.caption}
          </p>
        )}
        {multiple && (
          <div className="flex max-w-full gap-[var(--space-1)] overflow-x-auto pb-[2px]">
            {images.map((img, i) => (
              <button
                key={`${img.url}-${i}`}
                type="button"
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                onClick={() => onIndexChange(i)}
                className={`h-11 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border transition-all ${
                  i === index
                    ? 'border-[var(--color-accent-light)] opacity-100'
                    : 'border-[var(--color-border-subtle)] opacity-45 hover:opacity-80'
                }`}
              >
                {isVideoUrl(img.url) ? (
                  <video src={img.url} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
        <p
          className={`pointer-events-none font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)] transition-opacity duration-500 ${
            showHint && !isVideo ? 'opacity-40' : 'opacity-0'
          }`}
        >
          <span className="hidden sm:inline">scroll or click to zoom · drag to pan · esc to close</span>
          <span className="sm:hidden">pinch to zoom · swipe to browse</span>
        </p>
      </div>
    </div>,
    document.body,
  );
}
