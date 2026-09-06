import type { Project } from '../types';
import { monthIndex } from './score.ts';
import type { Atlas, Settlement, Tier } from './types.ts';

/*
 * The chronicle (stage 6): the archipelago as it stood on a given month.
 * Positions and paintings never change; what a date decides is which
 * settlements exist, how big each has grown, and which lanes have both ends.
 *
 *   - A settlement exists from its project's start month.
 *   - It appears as a hamlet and climbs one tier at a time toward the tier
 *     it has today, reaching it in the project's end month; each tier gets
 *     an equal share of the duration. Work still in progress stays a ruin,
 *     as it is today.
 *   - The crown and the pennant appear in the end month.
 *   - A lane exists once both of its ends do.
 *
 * `atlasAt` is pure; at the current month it reproduces today's atlas
 * exactly (open-ended dates resolve to `atlas.asOf`, the same month the
 * scores were computed for), which `scripts/print-atlas.ts --check-chronicle`
 * asserts.
 */

/** Months are counted as year × 12 + month (1 to 12), the unit score.ts uses. */
export type Month = number;

export interface SettlementState {
  tier: Tier;
  crown: boolean;
  pennant: boolean;
}

export interface ChronicleFrame {
  month: Month;
  /** Only the settlements that exist on the month. */
  states: ReadonlyMap<string, SettlementState>;
  /** Lanes whose both ends exist. */
  laneIds: ReadonlySet<string>;
  settledIslands: number;
}

/** Tiers in the order a settlement grows through them. */
const GROWTH: readonly Tier[] = ['hamlet', 'market-town', 'walled-town', 'fortress'];

export function monthOfDate(date: Date): Month {
  return date.getFullYear() * 12 + date.getMonth() + 1;
}

export function monthOfString(value: string): Month | null {
  return monthIndex(value, 'end', value);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatMonth(month: Month): string {
  const year = Math.floor((month - 1) / 12);
  const index = month - 1 - year * 12;
  return `${MONTH_NAMES[index]} ${year}`;
}

export function yearOf(month: Month): number {
  return Math.floor((month - 1) / 12);
}

/** The slider's span: the earliest start month to the atlas's month. */
export function chronicleRange(projects: readonly Project[], atlas: Atlas): { first: Month; last: Month } {
  const last = monthOfString(atlas.asOf) ?? monthOfDate(new Date());
  let first = last;
  for (const project of projects) {
    const start = monthIndex(project.startDate, 'start', atlas.asOf);
    if (start !== null && start < first) first = start;
  }
  return { first: Math.min(first, last - 1), last };
}

function stateAt(project: Project, settlement: Settlement, month: Month, asOf: string): SettlementState | null {
  const start = monthIndex(project.startDate, 'start', asOf);
  const end = monthIndex(project.endDate, 'end', asOf) ?? start;
  if (start !== null && month < start) return null;
  const finished = end === null || month >= end;
  const crown = settlement.isCapital && finished;
  const pennant = settlement.hasPennant && finished;
  // No start date: nothing to grow from, so the settlement stands as today.
  if (settlement.tier === 'ruin' || start === null || end === null || finished) {
    return { tier: settlement.tier, crown, pennant };
  }
  const final = GROWTH.indexOf(settlement.tier);
  if (final <= 0) return { tier: 'hamlet', crown, pennant };
  const progress = end > start ? (month - start) / (end - start) : 1;
  const step = Math.min(final, Math.floor(progress * (final + 1)));
  return { tier: GROWTH[step], crown, pennant };
}

export function atlasAt(atlas: Atlas, projects: readonly Project[], month: Month): ChronicleFrame {
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  const states = new Map<string, SettlementState>();
  const islands = new Set<string>();
  for (const settlement of atlas.settlements) {
    const project = bySlug.get(settlement.slug);
    if (!project) continue;
    const state = stateAt(project, settlement, month, atlas.asOf);
    if (!state) continue;
    states.set(settlement.slug, state);
    islands.add(settlement.islandId);
  }
  const laneIds = new Set<string>();
  for (const lane of atlas.lanes) {
    if (states.has(lane.from) && states.has(lane.to)) laneIds.add(lane.id);
  }
  return { month, states, laneIds, settledIslands: islands.size };
}

/**
 * The atlas as the DOM layers should see it on the frame's month: absent
 * settlements dropped, tiers and marks as they stood, lanes filtered. The
 * seats and bounds stay those of today, so nothing on screen moves.
 */
export function chronicleAtlas(atlas: Atlas, frame: ChronicleFrame): Atlas {
  const settlements = atlas.settlements.flatMap((settlement) => {
    const state = frame.states.get(settlement.slug);
    if (!state) return [];
    if (state.tier === settlement.tier && state.crown === settlement.isCapital && state.pennant === settlement.hasPennant) {
      return [settlement];
    }
    return [{ ...settlement, tier: state.tier, isCapital: state.crown, hasPennant: state.pennant }];
  });
  return {
    ...atlas,
    settlements,
    lanes: atlas.lanes.filter((lane) => frame.laneIds.has(lane.id)),
  };
}

/** True when the frame reproduces the atlas exactly: every settlement present as it is today, every lane kept. */
export function frameMatchesToday(atlas: Atlas, frame: ChronicleFrame): boolean {
  if (frame.states.size !== atlas.settlements.length || frame.laneIds.size !== atlas.lanes.length) return false;
  return atlas.settlements.every((settlement) => {
    const state = frame.states.get(settlement.slug);
    return (
      state !== undefined &&
      state.tier === settlement.tier &&
      state.crown === settlement.isCapital &&
      state.pennant === settlement.hasPennant
    );
  });
}

/* ---- Store -------------------------------------------------------------- */

export interface Chronicle {
  /** The scrubbed month, or null for today. */
  month: Month | null;
  /** Held by the lock: no easing back to today on release. */
  pinned: boolean;
  /** The slider is being dragged or keyed. */
  scrubbing: boolean;
}

export interface ChronicleStore {
  get(): Chronicle;
  set(patch: Partial<Chronicle>): void;
  subscribe(listener: () => void): () => void;
}

export function createChronicleStore(): ChronicleStore {
  let state: Chronicle = { month: null, pinned: false, scrubbing: false };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      if (next.month === state.month && next.pinned === state.pinned && next.scrubbing === state.scrubbing) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
