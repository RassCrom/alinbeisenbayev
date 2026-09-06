import { useEffect, useMemo, useRef } from 'react';
import { worldToScreen, type ViewStore } from './camera.ts';
import type { Atlas, Lane } from './types.ts';

/*
 * Sea lanes and roads as one SVG above the canvas. Each lane is a gentle
 * quadratic arc between two settlements; the bow always bends to the same
 * side for a given pair, so nothing flips as the camera moves. Paths are
 * rewritten straight from the view store, outside React's render.
 */

interface Props {
  atlas: Atlas;
  store: ViewStore;
}

/** How far the arc bows out, as a fraction of the lane's length. */
const BOW = 0.14;

export default function AtlasLanes({ atlas, store }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const bySlug = useMemo(() => new Map(atlas.settlements.map((s) => [s.slug, s])), [atlas]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const paths = new Map<string, SVGPathElement>();
    svg.querySelectorAll<SVGPathElement>('path[data-lane]').forEach((path) => {
      paths.set(path.dataset.lane ?? '', path);
    });
    return store.subscribe(({ camera, viewport }) => {
      svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
      for (const lane of atlas.lanes) {
        const path = paths.get(lane.id);
        const from = bySlug.get(lane.from);
        const to = bySlug.get(lane.to);
        if (!path || !from || !to) continue;
        const a = worldToScreen(camera, viewport, from.x, from.y);
        const b = worldToScreen(camera, viewport, to.x, to.y);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const side = bowSide(lane);
        const cx = (a.x + b.x) / 2 - (dy / length) * length * BOW * side;
        const cy = (a.y + b.y) / 2 + (dx / length) * length * BOW * side;
        path.setAttribute('d', `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
      }
    });
  }, [atlas, bySlug, store]);

  return (
    <svg ref={svgRef} className="atlas-lanes" aria-hidden="true">
      {atlas.lanes.map((lane) => (
        <path
          key={lane.id}
          data-lane={lane.id}
          className={lane.crossing ? 'atlas-lane--sea' : 'atlas-lane--road'}
        />
      ))}
    </svg>
  );
}

/** +1 or -1 from the lane id, so the bow direction is stable. */
function bowSide(lane: Lane): 1 | -1 {
  let hash = 0;
  for (let i = 0; i < lane.id.length; i++) hash = (hash * 31 + lane.id.charCodeAt(i)) | 0;
  return hash % 2 === 0 ? 1 : -1;
}
