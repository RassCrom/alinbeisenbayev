/*
 * The map's one icon set: ink-drawn symbols in the manner of a 16th-century
 * chart. Each sits on a 32-unit square, outlined in ink and washed with the
 * pin's status pigment (`--c`, set by the caller).
 */

export type GlyphKind = 'venue' | 'organizer';

/** A wax seal's scalloped edge, generated once. */
const SEAL = (() => {
  const n = 14;
  const r = 10.6;
  const bump = 13;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 16 + r * Math.cos(a);
    const y = 16 + r * Math.sin(a);
    if (i === 0) {
      d += `M${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      const m = a - Math.PI / n;
      d += `Q${(16 + bump * Math.cos(m)).toFixed(2)} ${(16 + bump * Math.sin(m)).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  return `${d}Z`;
})();

const STAR = 'M16 9.2 17.7 14.3 22.8 16 17.7 17.7 16 22.8 14.3 17.7 9.2 16 14.3 14.3Z';

/** A walled town with two towers and a pennant: where a program is judged or presented. */
function Castle() {
  return (
    <>
      <path className="aw-g-pennant" d="M8.5 9.2V3.6l4.4 1.5-4.4 1.6" />
      <path
        className="aw-g-fill"
        d="M5 27V9.2h2.4v2h2.2v-2H12V15h1.6v-2H15v2h2v-2h1.4v2H20V9.2h2.4v2h2.2v-2H27V27Z"
      />
      <path className="aw-g-ink" d="M14 27v-4.4a2 2 0 0 1 4 0V27Z" />
      <path className="aw-g-line" d="M8.5 15v3.6M23.5 15v3.6M3 27.4h26" />
    </>
  );
}

/** A wax seal with a four-point star: the organizer's seat. */
function Seal() {
  return (
    <>
      <path className="aw-g-fill" d={SEAL} />
      <circle className="aw-g-ring" cx="16" cy="16" r="8.2" />
      <path className="aw-g-star" d={STAR} />
    </>
  );
}

export function Glyph({ kind, approx = false, size = 28 }: { kind: GlyphKind; approx?: boolean; size?: number }) {
  return (
    <svg className="aw-glyph" width={size} height={size} viewBox="-2 -2 36 36" aria-hidden="true" focusable="false">
      {approx && <circle className="aw-g-approx" cx="16" cy="16" r="16.6" />}
      <g opacity={approx ? 0.72 : 1}>{kind === 'venue' ? <Castle /> : <Seal />}</g>
    </svg>
  );
}

/**
 * A sixteen-point wind rose with a fleur-de-lis on north, the ornament every
 * chart of the period carried. Purely decorative: north is always up here.
 */
export function CompassRose({ size }: { size: number }) {
  const long: string[] = [];
  const short: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const len = i % 2 === 0 ? 46 : 32;
    const w = i % 2 === 0 ? 7 : 5.5;
    const tip = [50 + len * Math.sin(a), 50 - len * Math.cos(a)];
    const l = [50 + w * Math.sin(a - Math.PI / 2), 50 - w * Math.cos(a - Math.PI / 2)];
    const r = [50 + w * Math.sin(a + Math.PI / 2), 50 - w * Math.cos(a + Math.PI / 2)];
    // Each point is two halves, one inked and one left as paper, like an engraving.
    long.push(`M50 50L${l[0].toFixed(2)} ${l[1].toFixed(2)}L${tip[0].toFixed(2)} ${tip[1].toFixed(2)}Z`);
    short.push(`M50 50L${tip[0].toFixed(2)} ${tip[1].toFixed(2)}L${r[0].toFixed(2)} ${r[1].toFixed(2)}Z`);
  }
  const minor: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const tip = [50 + 22 * Math.sin(a), 50 - 22 * Math.cos(a)];
    const l = [50 + 3.4 * Math.sin(a - Math.PI / 2), 50 - 3.4 * Math.cos(a - Math.PI / 2)];
    const r = [50 + 3.4 * Math.sin(a + Math.PI / 2), 50 - 3.4 * Math.cos(a + Math.PI / 2)];
    minor.push(`M${l[0].toFixed(2)} ${l[1].toFixed(2)}L${tip[0].toFixed(2)} ${tip[1].toFixed(2)}L${r[0].toFixed(2)} ${r[1].toFixed(2)}Z`);
  }
  return (
    <svg className="aw-rose" width={size} height={size} viewBox="-6 -14 112 120" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="36" className="aw-rose-ring" />
      <circle cx="50" cy="50" r="33" className="aw-rose-ring aw-rose-thin" />
      <path d={minor.join('')} className="aw-rose-minor" />
      <path d={long.join('')} className="aw-rose-dark" />
      <path d={short.join('')} className="aw-rose-light" />
      <circle cx="50" cy="50" r="3.2" className="aw-rose-hub" />
      {/* Fleur-de-lis on north. */}
      <path
        className="aw-rose-fleur"
        d="M50 -12c-3.2 3.6-3.6 7.4-1.2 11.6-3.4-1.6-6.8-.6-7.4 2.4 3.2-.6 5.4.6 6.6 2.8h4c1.2-2.2 3.4-3.4 6.6-2.8-.6-3-4-4-7.4-2.4 2.4-4.2 2-8-1.2-11.6Z"
      />
    </svg>
  );
}
