import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { projects } from '../data/projects';
import { worldToScreen, type ViewStore } from './camera.ts';
import { TIER_LABEL } from './config.ts';
import { spriteRect, type InteractionStore } from './interaction.ts';
import type { Atlas } from './types.ts';

/*
 * What follows the active settlement: the gold ring on the ground and the
 * dark-glass card from concept 10, built from the same facts WorkCard
 * shows (cover, title, one line, tags). The card sits beside the sprite
 * and flips to the other side or slides vertically to stay on screen. Its
 * cover carries the view-transition name the detail hero pairs with, so
 * opening from here morphs the card's cover into the hero, as the works
 * grid does.
 */

interface Props {
  atlas: Atlas;
  store: ViewStore;
  interaction: InteractionStore;
  onOpen: (slug: string) => void;
}

const CARD_WIDTH = 272;
const CARD_GAP = 18;
const EDGE = 12;
/** Ring width as a multiple of the settlement footprint; height is a squashed ellipse. */
const RING_SCALE = 2.9;
const RING_SQUASH = 0.52;

const TYPE_LABEL: Record<string, string> = {
  'static-map': 'Print / static map',
  website: 'Interactive web',
  animation: 'Animation',
};

export default function AtlasFocus({ atlas, store, interaction, onOpen }: Props) {
  const activeSlug = useSyncExternalStore(interaction.subscribe, interaction.active);
  const bySlug = useMemo(() => new Map(atlas.settlements.map((s) => [s.slug, s])), [atlas]);
  const settlement = activeSlug ? bySlug.get(activeSlug) : undefined;
  const project = activeSlug ? projects.find((p) => p.slug === activeSlug) : undefined;
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settlement) return;
    return store.subscribe(({ camera, viewport }) => {
      const ring = ringRef.current;
      const card = cardRef.current;
      const ground = worldToScreen(camera, viewport, settlement.x, settlement.y);
      const width = settlement.footprint * RING_SCALE * camera.zoom;
      if (ring) {
        ring.style.width = `${width.toFixed(1)}px`;
        ring.style.height = `${(width * RING_SQUASH).toFixed(1)}px`;
        ring.style.transform = `translate(${(ground.x - width / 2).toFixed(1)}px, ${(ground.y - (width * RING_SQUASH) / 2).toFixed(1)}px)`;
      }
      if (card) {
        const rect = spriteRect(settlement, camera, viewport);
        const height = card.offsetHeight;
        let left = rect.right + CARD_GAP;
        if (left + CARD_WIDTH > viewport.width - EDGE) left = rect.left - CARD_GAP - CARD_WIDTH;
        left = Math.max(EDGE, Math.min(viewport.width - CARD_WIDTH - EDGE, left));
        const middle = (rect.top + rect.bottom) / 2;
        const top = Math.max(EDGE, Math.min(viewport.height - height - EDGE, middle - height / 2));
        card.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
      }
    });
  }, [settlement, store]);

  if (!settlement || !project) return null;

  const year = project.endDate ? Number(project.endDate.slice(0, 4)) || null : null;
  const award = project.awards[0];

  return (
    <>
      <div ref={ringRef} className="atlas-ring is-on" aria-hidden="true" />
      <div
        ref={cardRef}
        className="atlas-tooltip is-on"
        style={{ width: CARD_WIDTH }}
        onClick={() => onOpen(project.slug)}
        role="presentation"
      >
        <img
          src={project.coverImage}
          alt=""
          width={1200}
          height={630}
          decoding="async"
          style={{ viewTransitionName: `cover-${project.slug}` }}
          className="atlas-tooltip__cover"
        />
        <div className="atlas-tooltip__body">
          <h3 className="atlas-tooltip__title">{project.title}</h3>
          <p className="atlas-tooltip__tagline">{project.tagline}</p>
          <div className="atlas-tooltip__pills">
            <span className="atlas-pill">{project.category}</span>
            {year !== null && <span className="atlas-pill">{year}</span>}
            <span className="atlas-pill">{TYPE_LABEL[project.type] ?? project.type}</span>
            <span className="atlas-pill">{TIER_LABEL[settlement.tier]}</span>
            {award && (
              <span className="atlas-pill atlas-pill--award" title={award}>
                ★ award
              </span>
            )}
            {project.status === 'in-progress' && <span className="atlas-pill">in progress</span>}
          </div>
          <span className="atlas-tooltip__hint">Open the sheet →</span>
        </div>
      </div>
    </>
  );
}
