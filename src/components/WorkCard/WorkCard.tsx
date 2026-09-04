import { useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';

export interface WorkCardProps {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  category: string;
  tagline: string;
  coverImage: string;
  award?: string;
  featured?: boolean;
  status?: string;
  type: string;
  /** Plate number rendered before the category tag (landing grid) */
  index?: number;
  /** Bento showcase variant: wider image, larger title */
  large?: boolean;
}

const MAX_TILT_DEG = 5;

export default function WorkCard({
  slug,
  title,
  year,
  tagline,
  coverImage,
  award,
  status,
  index,
  large = false,
}: WorkCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const reducedMotionRef = useRef<boolean | null>(null);

  // Pointer-tracked 3D tilt + spotlight position, written straight to the
  // element so mousemove never enters the React render path.
  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (reducedMotionRef.current === null) {
      reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    if (reducedMotionRef.current) return;
    const tiltX = (0.5 - py) * MAX_TILT_DEG;
    const tiltY = (px - 0.5) * MAX_TILT_DEG;
    el.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
  };

  const handleLeave = () => {
    const el = cardRef.current;
    if (el) el.style.transform = '';
  };

  /*
   * Warm the detail route while the pointer is still on the card.
   *
   * The route chunk is needed the instant the click lands, and hover reliably
   * precedes it by a few hundred milliseconds. Fired once per card. The same
   * specifier as App.tsx's lazy() import, so this resolves the very module the
   * router is about to await rather than a second copy.
   */
  const warming = useRef(false);
  const warm = useRef(false);
  const prefetch = useCallback(() => {
    if (warming.current) return;
    warming.current = true;
    import('../../pages/WorkDetailPage')
      .then(() => {
        warm.current = true;
      })
      .catch(() => {
        // A failed warm-up is not worth surfacing; the click will retry.
        warming.current = false;
      });
  }, []);

  /*
   * Morph the cover into the detail hero, when that can be done honestly.
   *
   * React Router's own `viewTransition` prop needs a data router
   * (RouterProvider); this app renders BrowserRouter, where it is silently
   * ignored — so the transition is driven here instead.
   *
   * Only when `warm` is true. startViewTransition snapshots whatever the DOM
   * shows after the update, and a route chunk that has not loaded yet renders
   * the Suspense fallback — so an un-warmed click would cross-fade the card
   * into the word "Loading…". Falling through to the plain <Link> in that case
   * is both simpler and better than a transition to nothing.
   */
  const navigate = useNavigate();
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!warm.current) return;
      if (typeof document.startViewTransition !== 'function') return;
      // Let the browser handle new-tab, download and middle-click gestures.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      event.preventDefault();
      const transition = document.startViewTransition(() => {
        // The callback must leave the DOM in its final state before it
        // resolves, so the router update cannot be deferred.
        flushSync(() => navigate(`/works/${slug}`));
      });
      /*
       * A skipped transition rejects `ready`, and nothing here needs to know.
       * The browser skips whenever it cannot animate — a backgrounded tab is
       * the common one — and the navigation itself has already happened by
       * then, so the only visible effect of not catching this is an uncaught
       * "Transition was aborted because of invalid state" in the console.
       */
      transition.ready.catch(() => {});
    },
    [navigate, slug],
  );

  return (
    <Link
      ref={cardRef}
      to={`/works/${slug}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onClick={handleClick}
      className="group relative block h-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)] transition-[transform,border-color,box-shadow] duration-200 ease-out will-change-transform hover:border-[var(--color-border-default)] hover:shadow-[var(--shadow-glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] active:scale-[0.99]"
    >
      <div className={`relative overflow-hidden ${large ? 'aspect-[2/1]' : 'aspect-video'}`}>
        <img
          src={coverImage}
          alt={title}
          width={1200}
          height={630}
          loading="lazy"
          decoding="async"
          /* Paired with the same name on the detail hero, so the browser
             morphs this thumbnail into it across the navigation. Scoped per
             slug: two elements sharing a name in one snapshot abort the
             transition, and only one card for a given slug is ever on screen. */
          style={{ viewTransitionName: `cover-${slug}` }}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-[var(--space-3)] top-[var(--space-3)] flex items-start gap-[var(--space-2)]">
          {index !== undefined && (
            <span className="shrink-0 rounded-[var(--radius-sm)] bg-[rgba(var(--color-chrome-rgb),0.8)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] tracking-wider text-[var(--color-text-secondary)]">
              {String(index + 1).padStart(2, '0')}
            </span>
          )}
          {award && (
            <span
              title={award}
              className="ml-auto rounded-[var(--radius-sm)] bg-[rgba(var(--color-chrome-rgb),0.8)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-base)] leading-none text-[var(--color-accent-gold)]"
            >
              ★
            </span>
          )}
        </div>
        {status === 'in-progress' && (
          <span className="absolute bottom-[var(--space-3)] left-[var(--space-3)] rounded-[var(--radius-sm)] bg-[var(--color-accent-glow)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-light)]">
            In Progress
          </span>
        )}
      </div>
      <div className={large ? 'p-[var(--space-6)]' : 'p-[var(--space-4)]'}>
        <div className="flex items-baseline justify-between gap-[var(--space-2)]">
          <h3
            className={`font-[family-name:var(--font-heading)] font-bold ${
              large ? 'text-[length:var(--text-2xl)]' : 'text-[length:var(--text-lg)]'
            }`}
          >
            {title}
          </h3>
          <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            {year}
          </span>
        </div>
        <p className="mt-[var(--space-2)] font-[family-name:var(--font-body)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
          {tagline}
        </p>
        <span className="mt-[var(--space-3)] inline-block font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-accent-light)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          View case study →
        </span>
      </div>
      {/* Cursor spotlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[var(--z-raised)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(var(--color-accent-light-rgb), 0.12), transparent 65%)',
        }}
      />
    </Link>
  );
}
