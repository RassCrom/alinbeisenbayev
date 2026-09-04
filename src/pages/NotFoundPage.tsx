import { Link, useLocation } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { formatCoordinates } from '../utils/coordinates';

/**
 * Deterministic coordinates for a path that doesn't exist.
 *
 * A map sheet you can't find still has a position — so the miss is given one,
 * derived from the URL itself. The same wrong address always lands in the same
 * place, which is the joke: it's a real coordinate, it's just nowhere useful.
 * FNV-1a, because it only has to scatter, not to be secure.
 */
function coordinatesForPath(path: string): { lat: number; lng: number } {
  let hash = 0x811c9dc5;
  for (let i = 0; i < path.length; i += 1) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Split the hash into two independent halves so lat and lng don't correlate.
  const lat = ((hash & 0xffff) / 0xffff) * 180 - 90;
  const lng = ((hash >>> 16) / 0xffff) * 360 - 180;
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}

/** The marginalia block every printed sheet carries, filled in for a sheet that was never made. */
const SHEET_NOTES: [string, string][] = [
  ['Projection', 'None'],
  ['Datum', 'Unknown'],
  ['Scale', '1 : ∞'],
  ['Sheet', '404'],
  ['Survey', 'Incomplete'],
];

export default function NotFoundPage() {
  const { pathname } = useLocation();
  usePageMeta(
    'Sheet not found',
    'This page is not on any sheet — the address does not match a work, post or section of the site.',
    { noindex: true },
  );

  const { lat, lng } = coordinatesForPath(pathname);

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-[var(--space-6)] py-[var(--space-16)]">
      {/* Same contour plate as the landing hero, faded further back */}
      <img
        src="/vienna-contours.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10]"
        style={{
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 78%)',
        }}
      />

      {/* Neatline — the double rule a printed sheet is framed with */}
      <div className="relative z-[var(--z-raised)] w-full max-w-2xl border border-[var(--color-border-default)] p-[3px]">
        <div className="border border-[var(--color-border-subtle)] bg-[rgba(var(--color-surface-rgb),0.82)] p-[var(--space-8)] backdrop-blur-sm sm:p-[var(--space-12)]">
          <p className="mono-label">Sheet 404 &middot; Unsurveyed</p>

          <h1 className="mt-[var(--space-4)] font-[family-name:var(--font-heading)] text-[length:var(--text-3xl)] font-extrabold tracking-tight sm:text-[length:var(--text-4xl)]">
            Off the edge of the map
          </h1>

          <p className="mt-[var(--space-4)] max-w-prose font-[family-name:var(--font-body)] text-[var(--color-text-secondary)]">
            Nothing has been surveyed at this address. The page may have been renamed,
            or the link that brought you here was drawn from an older edition.
          </p>

          {/* The requested path, rendered as the one thing a cartographer would give it: a position */}
          <div className="mt-[var(--space-8)] border-l-2 border-[var(--color-accent)] pl-[var(--space-4)]">
            <p className="mono-label">Requested position</p>
            <p className="coord-label mt-[var(--space-1)] text-[length:var(--text-lg)]">
              {formatCoordinates(lat, lng, { precision: 4 })}
            </p>
            <p className="mt-[var(--space-1)] break-all font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {pathname}
            </p>
          </div>

          {/* Margin notes, as on a printed sheet */}
          <dl className="mt-[var(--space-8)] grid grid-cols-2 gap-x-[var(--space-6)] gap-y-[var(--space-2)] border-t border-[var(--color-border-subtle)] pt-[var(--space-6)] sm:grid-cols-3">
            {SHEET_NOTES.map(([term, value]) => (
              <div key={term}>
                <dt className="mono-label">{term}</dt>
                <dd className="mt-[2px] font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-[var(--space-8)] flex flex-wrap gap-[var(--space-3)]">
            <Link to="/works" className="btn btn-primary">
              Browse the works
            </Link>
            <Link to="/" className="btn btn-secondary">
              Back to start
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
