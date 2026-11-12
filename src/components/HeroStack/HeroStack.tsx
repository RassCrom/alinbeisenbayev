import Frame from '../Frame/Frame';
import { useTilt } from '../../hooks/useTilt';
import type { Project } from '../../types';

/** Shape of each sheet, front to back. The front one is a landscape print; the two behind are portrait. */
const SHEETS = [
  { ratio: '3 / 2', width: 1500, height: 1000, sizes: '(min-width: 768px) 46vw, 92vw' },
  { ratio: '4 / 5', width: 800, height: 1000, sizes: '(min-width: 768px) 24vw, 47vw' },
  { ratio: '4 / 5', width: 800, height: 1000, sizes: '(min-width: 768px) 23vw, 45vw' },
] as const;

/**
 * The home page's depth: up to three real covers standing at different
 * distances, leaning a few degrees toward the pointer.
 *
 * Decoration only. The same works are listed, linked and named right below,
 * so this is hidden from assistive tech and carries no links of its own.
 */
export default function HeroStack({ works }: { works: Project[] }) {
  const tilt = useTilt<HTMLDivElement>(3);
  const sheets = works.slice(0, SHEETS.length);
  if (sheets.length === 0) return null;

  return (
    <div
      className="hero-stack"
      aria-hidden="true"
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <div className="hero-stack__tilt">
        {/* Back to front, so the front sheet also paints last where 3D is unavailable. */}
        {sheets
          .map((work, index) => (
            <div key={work.id} className={`hero-stack__sheet hero-stack__sheet--${index + 1}`}>
              <Frame
                src={work.coverImage}
                alt=""
                width={SHEETS[index].width}
                height={SHEETS[index].height}
                ratio={SHEETS[index].ratio}
                sizes={SHEETS[index].sizes}
                priority={index === 0}
              />
            </div>
          ))
          .reverse()}
      </div>
    </div>
  );
}
