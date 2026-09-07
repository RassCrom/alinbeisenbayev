import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { projects } from '../data/projects';
import { usePageMeta } from '../hooks/usePageMeta';
import { TIER_LABEL } from './config.ts';
import { buildAtlas } from './index.ts';
import { POSTER_FRAME } from './poster-frame.ts';
import { setViewMode } from './viewMode.ts';
import './poster.css';

/*
 * The poster fallback (stage 7): for a browser without WebGL2, the
 * archipelago as one pre-baked image (scripts/bake-atlas-poster.py) with a
 * plain link over every settlement, placed from the same buildAtlas layout
 * the poster was drawn from. No canvas, no frame loop.
 */

export default function AtlasPoster() {
  usePageMeta();
  const atlas = useMemo(() => buildAtlas(projects), []);
  const spanX = POSTER_FRAME.maxX - POSTER_FRAME.minX;
  const spanY = POSTER_FRAME.maxY - POSTER_FRAME.minY;
  const at = (x: number, y: number): { left: string; top: string } => ({
    left: `${(((x - POSTER_FRAME.minX) / spanX) * 100).toFixed(3)}%`,
    top: `${(((y - POSTER_FRAME.minY) / spanY) * 100).toFixed(3)}%`,
  });
  const bySlug = useMemo(() => new Map(projects.map((p) => [p.slug, p])), []);

  return (
    <div className="atlas-poster">
      <div className="atlas-poster__sheet" style={{ aspectRatio: `${POSTER_FRAME.width} / ${POSTER_FRAME.height}` }}>
        <img
          className="atlas-poster__image"
          src="/atlas/poster.webp"
          width={POSTER_FRAME.width}
          height={POSTER_FRAME.height}
          alt={`The atlas of works as of ${POSTER_FRAME.asOf}: an archipelago of ${atlas.islands.length} islands with a settlement per project.`}
        />
        <nav className="atlas-poster__hotspots" aria-label="Settlements">
          {atlas.settlements.map((settlement) => {
            const project = bySlug.get(settlement.slug);
            const large = settlement.tier === 'fortress' || settlement.tier === 'walled-town' || settlement.tier === 'market-town';
            return (
              <Link
                key={settlement.slug}
                to={`/works/${settlement.slug}`}
                className={`atlas-poster__spot atlas-poster__spot--${settlement.tier}${settlement.isCapital ? ' is-capital' : ''}`}
                style={at(settlement.x, settlement.y)}
                title={`${settlement.title}, ${TIER_LABEL[settlement.tier].toLowerCase()}${project ? `, ${project.category}` : ''}`}
              >
                <span className="atlas-poster__mark" aria-hidden="true" />
                <span className={`atlas-poster__label${large ? '' : ' atlas-poster__label--small'}`}>{settlement.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <p className="atlas-poster__note">
        This browser has no WebGL, so the chart is shown as a still, as of {POSTER_FRAME.asOf}. Every settlement is a
        link.{' '}
        <button type="button" className="atlas-poster__switch" onClick={() => setViewMode('sheet')}>
          Sheet view
        </button>
      </p>
    </div>
  );
}
