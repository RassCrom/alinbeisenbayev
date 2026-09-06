import type { Lane, Settlement } from './types.ts';

/*
 * The shape of a lane, shared by the SVG that draws it and the boats that
 * sail it: a quadratic arc between the two settlements whose bow always
 * bends to the same side for a given pair. Quadratic curves are affine
 * invariant, so the same control point serves in world and screen space.
 */

/** How far the arc bows out, as a fraction of the lane's length. */
export const LANE_BOW = 0.14;

/** +1 or -1 from the lane id, so the bow direction is stable. */
export function bowSide(lane: Lane): 1 | -1 {
  let hash = 0;
  for (let i = 0; i < lane.id.length; i++) hash = (hash * 31 + lane.id.charCodeAt(i)) | 0;
  return hash % 2 === 0 ? 1 : -1;
}

export interface LaneCurve {
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  bx: number;
  by: number;
  /** Straight-line length, world units. */
  length: number;
}

export function laneCurve(lane: Lane, from: Settlement, to: Settlement): LaneCurve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1e-6;
  const side = bowSide(lane);
  return {
    ax: from.x,
    ay: from.y,
    cx: (from.x + to.x) / 2 - (dy / length) * length * LANE_BOW * side,
    cy: (from.y + to.y) / 2 + (dx / length) * length * LANE_BOW * side,
    bx: to.x,
    by: to.y,
    length,
  };
}

/** Point on the curve at t in 0..1. */
export function curvePoint(curve: LaneCurve, t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * curve.ax + 2 * u * t * curve.cx + t * t * curve.bx,
    y: u * u * curve.ay + 2 * u * t * curve.cy + t * t * curve.by,
  };
}

/** Direction of travel at t, radians, screen convention (x east, y south). */
export function curveHeading(curve: LaneCurve, t: number): number {
  const dx = 2 * (1 - t) * (curve.cx - curve.ax) + 2 * t * (curve.bx - curve.cx);
  const dy = 2 * (1 - t) * (curve.cy - curve.ay) + 2 * t * (curve.by - curve.cy);
  return Math.atan2(dy, dx);
}
