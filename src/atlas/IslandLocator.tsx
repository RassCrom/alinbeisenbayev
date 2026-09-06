import { useMemo } from 'react';
import { projects } from '../data/projects';
import { islandSprite } from './assets.ts';
import { TIER_LABEL } from './config.ts';
import { buildAtlas } from './index.ts';
import { paintingHalfWidth } from './layout.ts';
import type { Atlas } from './types.ts';
import './locator.css';

/*
 * The detail page's locator (stage 5): the project's island painting with a
 * pin on its settlement, in the map's own style. Plain DOM and one image;
 * no WebGL. The atlas is built once per session and shared.
 */

interface Props {
  slug: string;
  /** Rendered width in CSS pixels. */
  size?: number;
}

let cached: Atlas | null = null;
function atlas(): Atlas {
  cached ??= buildAtlas(projects);
  return cached;
}

export default function IslandLocator({ slug, size = 148 }: Props) {
  const found = useMemo(() => {
    const a = atlas();
    const settlement = a.settlements.find((s) => s.slug === slug);
    const island = settlement ? a.islands.find((i) => i.id === settlement.islandId) : undefined;
    if (!settlement || !island) return null;
    const half = paintingHalfWidth(island);
    return {
      island,
      settlement,
      // The settlement's place within the painting's square, 0 to 1.
      u: (settlement.x - island.x) / (2 * half) + 0.5,
      v: (settlement.y - island.y) / (2 * half) + 0.5,
    };
  }, [slug]);

  if (!found) return null;
  const { island, settlement, u, v } = found;

  return (
    <figure className="island-locator" style={{ width: size }}>
      <div className="island-locator__sea" style={{ height: size }}>
        <img
          src={islandSprite(island.id).src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="island-locator__painting"
        />
        <span
          className="island-locator__pin"
          style={{ left: `${(u * 100).toFixed(2)}%`, top: `${(v * 100).toFixed(2)}%` }}
          aria-hidden="true"
        />
      </div>
      <figcaption className="island-locator__caption">
        <span className="island-locator__name">{island.name}</span>
        <span className="island-locator__tier">
          {TIER_LABEL[settlement.tier].toLowerCase()} · {island.category}
        </span>
      </figcaption>
    </figure>
  );
}
