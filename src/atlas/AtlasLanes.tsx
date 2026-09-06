import { useEffect, useMemo, useRef } from 'react';
import { worldToScreen, type ViewStore } from './camera.ts';
import type { InteractionStore } from './interaction.ts';
import { laneCurve } from './lanes.ts';
import type { Atlas } from './types.ts';

/*
 * Sea lanes and roads as one SVG above the canvas, each a quadratic arc from
 * lanes.ts drawn through the camera; quadratic curves are affine invariant,
 * so projecting the three world points is exact. Paths are rewritten
 * straight from the view store, outside React's render. While a settlement
 * is active its lanes light up gold and the rest step back; while a trade
 * good is active, the lanes between its settlements light.
 */

interface Props {
  atlas: Atlas;
  store: ViewStore;
  interaction: InteractionStore;
}

export default function AtlasLanes({ atlas, store, interaction }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const curves = useMemo(() => {
    const bySlug = new Map(atlas.settlements.map((s) => [s.slug, s]));
    return atlas.lanes.map((lane) => {
      const from = bySlug.get(lane.from);
      const to = bySlug.get(lane.to);
      return from && to ? laneCurve(lane, from, to) : null;
    });
  }, [atlas]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const paths = new Map<string, SVGPathElement>();
    svg.querySelectorAll<SVGPathElement>('path[data-lane]').forEach((path) => {
      paths.set(path.dataset.lane ?? '', path);
    });

    const unsubscribeView = store.subscribe(({ camera, viewport }) => {
      svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
      atlas.lanes.forEach((lane, index) => {
        const path = paths.get(lane.id);
        const curve = curves[index];
        if (!path || !curve) return;
        const a = worldToScreen(camera, viewport, curve.ax, curve.ay);
        const c = worldToScreen(camera, viewport, curve.cx, curve.cy);
        const b = worldToScreen(camera, viewport, curve.bx, curve.by);
        path.setAttribute('d', `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
      });
    });

    const light = (): void => {
      const highlights = interaction.highlights();
      const set = new Set(highlights);
      for (const lane of atlas.lanes) {
        const path = paths.get(lane.id);
        if (!path) continue;
        const lit =
          set.size === 1
            ? set.has(lane.from) || set.has(lane.to)
            : set.size > 1 && set.has(lane.from) && set.has(lane.to);
        path.classList.toggle('is-lit', lit);
        path.classList.toggle('is-dim', set.size > 0 && !lit);
      }
    };
    light();
    const unsubscribeInteraction = interaction.subscribe(light);

    return () => {
      unsubscribeView();
      unsubscribeInteraction();
    };
  }, [atlas, curves, interaction, store]);

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
