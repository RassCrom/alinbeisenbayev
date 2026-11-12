import { useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import Frame from '../Frame/Frame';
import { firstOfferLabel } from '../../data/offers';
import { useTilt } from '../../hooks/useTilt';
import { COVER_SIZES } from '../../utils/images';
import { prefersReducedMotion } from '../../utils/motion';
import type { Project } from '../../types';

export interface WorkCardProps {
  project: Project;
  /** `lead` is the full-width feature; `half` sits two or three to a row. */
  size?: 'lead' | 'half';
  /** Cover shape, e.g. '3 / 2'. Defaults to 16 / 9 for the lead and 4 / 3 otherwise. */
  ratio?: string;
  /** Load the cover eagerly: for a card that is on screen when the page opens. */
  priority?: boolean;
}

/**
 * A work, as the cover, its title and one line saying what kind of thing it
 * is. Nothing else: the cover is the argument.
 */
export default function WorkCard({ project, size = 'half', ratio, priority = false }: WorkCardProps) {
  const { slug, title, coverImage } = project;
  const label = firstOfferLabel(project.offers ?? []);
  const lead = size === 'lead';
  const tilt = useTilt<HTMLAnchorElement>();

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
   * Grow the cover into the detail hero, when that can be done honestly.
   *
   * React Router's own `viewTransition` prop needs a data router
   * (RouterProvider); this app renders BrowserRouter, where it is silently
   * ignored, so the transition is driven here instead.
   *
   * Only when `warm` is true. startViewTransition snapshots whatever the DOM
   * shows after the update, and a route chunk that has not loaded yet renders
   * the Suspense fallback, so an un-warmed click would morph the cover into a
   * skeleton. Falling through to the plain <Link> is simpler and better.
   */
  const navigate = useNavigate();
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!warm.current) return;
      if (typeof document.startViewTransition !== 'function') return;
      // Let the browser handle new-tab, download and middle-click gestures.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;
      if (prefersReducedMotion()) return;

      event.preventDefault();
      const transition = document.startViewTransition(() => {
        // The callback must leave the DOM in its final state before it
        // resolves, so the router update cannot be deferred.
        flushSync(() => navigate(`/works/${slug}`));
      });
      // The browser skips a transition it cannot animate (a backgrounded tab,
      // usually) and rejects `ready`; the navigation has already happened.
      transition.ready.catch(() => {});
    },
    [navigate, slug],
  );

  return (
    <Link
      ref={tilt.ref}
      to={`/works/${slug}`}
      className={lead ? 'work-card work-card--lead' : 'work-card'}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onClick={handleClick}
    >
      <Frame
        src={coverImage}
        // The title is the heading right below; reading it twice helps nobody.
        alt=""
        width={lead ? 1600 : 1200}
        height={900}
        ratio={ratio ?? (lead ? '16 / 9' : '4 / 3')}
        sizes={lead ? COVER_SIZES.hero : COVER_SIZES.card}
        priority={priority}
        /* Paired with the same name on the detail hero. Scoped per slug: two
           elements sharing a name in one snapshot abort the transition. */
        viewTransitionName={`cover-${slug}`}
      />
      <div className="work-card__text">
        <h3 className={lead ? 't-h2' : 't-h3'}>{title}</h3>
        {label && <p className="t-meta">{label}</p>}
      </div>
    </Link>
  );
}
