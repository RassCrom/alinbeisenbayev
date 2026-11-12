/** The most a surface may lean toward the pointer, in degrees. */
export const MAX_TILT_DEG = 6;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Rotation for a surface that leans toward the pointer.
 *
 * `px` and `py` are the pointer's position inside the element, 0 to 1 from
 * the top-left corner; values outside are clamped. The centre is flat and
 * each edge reaches `max`.
 */
export function tiltFor(px: number, py: number, max: number = MAX_TILT_DEG): { rx: number; ry: number } {
  return {
    rx: (0.5 - clamp01(py)) * 2 * max,
    ry: (clamp01(px) - 0.5) * 2 * max,
  };
}
