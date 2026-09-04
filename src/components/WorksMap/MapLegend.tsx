/** Kept in step with HUB_DOT_MIN/MAX and hubDotSize in WorksMap.tsx. */
const HUB_DOT_MIN = 12;
const HUB_DOT_MAX = 32;

function hubDotSize(count: number, max: number): number {
  if (max <= 1) return HUB_DOT_MIN;
  const t = (Math.sqrt(count) - 1) / (Math.sqrt(max) - 1);
  return HUB_DOT_MIN + t * (HUB_DOT_MAX - HUB_DOT_MIN);
}

export interface MapLegendProps {
  /** Projects made in the busiest city — the top of the graduated scale. */
  busiestHub: number;
}

/**
 * The map's key.
 *
 * Hub symbols are graduated, so they need one: a reader cannot tell that a
 * circle means "21 projects were made here" without being told, and the whole
 * point of grading them was to stop Vienna and Dresden looking identical.
 *
 * Classed breaks are the min, a middle value and the max, which is the
 * convention for a proportional-symbol key — three circles nested or in a row,
 * each labelled with the count it represents.
 */
export default function MapLegend({ busiestHub }: MapLegendProps) {
  // 1, something in between, and the busiest — deduped for small datasets.
  const breaks = [...new Set([1, Math.max(1, Math.round(busiestHub / 4)), busiestHub])].sort(
    (a, b) => a - b,
  );

  return (
    <div className="flex flex-wrap items-end gap-x-[var(--space-6)] gap-y-[var(--space-3)]">
      <div>
        <p className="mono-label">Works made here</p>
        <div className="mt-[var(--space-2)] flex items-end gap-[var(--space-3)]">
          {breaks.map((count) => {
            const size = hubDotSize(count, busiestHub);
            return (
              <div key={count} className="flex flex-col items-center gap-[var(--space-1)]">
                <span
                  className="map-legend-swatch"
                  style={
                    {
                      '--swatch-size': `${size.toFixed(1)}px`,
                      width: `${HUB_DOT_MAX}px`,
                      height: `${size.toFixed(1)}px`,
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                />
                <span className="font-[family-name:var(--font-mono)] text-[9px] tabular-nums text-[var(--color-text-muted)]">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deliberately no blue/gold swatch here: the map draws its own
          "Created in / Mapped place" key in the corner, and repeating it a few
          centimetres away is the sort of thing this key exists to avoid. What
          the map cannot say for itself is what the circle *sizes* mean. */}
      <p className="max-w-[24ch] font-[family-name:var(--font-mono)] text-[9px] leading-relaxed text-[var(--color-text-muted)]">
        Circle area is proportional to the number of works made in that city.
      </p>
    </div>
  );
}
