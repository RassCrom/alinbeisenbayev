/*
 * The guided tour: a route through the featured works in their curated
 * order. Each stop flies the camera to the settlement, shows its card,
 * waits, and moves on; the visitor can step forward and back, and any
 * gesture on the map ends it. The tour owns nothing but the sequence and
 * its timer: how to fly and what to show come in as hooks, so the view
 * keeps the camera and the interaction store to itself.
 */

export interface TourState {
  running: boolean;
  /** The stop being shown, 0-based; meaningless while not running. */
  index: number;
  total: number;
  slug: string | null;
}

export interface TourHooks {
  /** Fly to the stop; resolves when the camera arrives or the flight is cut short. */
  travel(slug: string): Promise<void>;
  /** Show the stop's card, or clear it with null. */
  present(slug: string | null): void;
  /** The tour ended: after its last stop (`completed`) or by a stop. */
  onEnd?(completed: boolean): void;
}

export interface Tour {
  get(): TourState;
  subscribe(listener: () => void): () => void;
  /** Begin at a stop (the first by default); a running tour restarts there. */
  start(at?: number): void;
  next(): void;
  prev(): void;
  stop(): void;
  /** How long each stop is shown, for the progress bar. */
  readonly dwellMs: number;
}

export function createTour(stops: readonly string[], hooks: TourHooks, dwellMs = 4600): Tour {
  let state: TourState = { running: false, index: 0, total: stops.length, slug: null };
  const listeners = new Set<() => void>();
  let timer = 0;
  /** Bumped on every move, so a flight that lands after a stop or a skip does nothing. */
  let sequence = 0;

  const emit = (next: TourState): void => {
    state = next;
    for (const listener of listeners) listener();
  };
  const clearTimer = (): void => {
    if (timer !== 0) window.clearTimeout(timer);
    timer = 0;
  };

  const end = (completed: boolean): void => {
    clearTimer();
    sequence += 1;
    if (!state.running) return;
    emit({ ...state, running: false, slug: null });
    hooks.present(null);
    hooks.onEnd?.(completed);
  };

  const goTo = (index: number): void => {
    if (stops.length === 0) return;
    if (index >= stops.length) {
      end(true);
      return;
    }
    clearTimer();
    const token = ++sequence;
    const slug = stops[Math.max(0, index)];
    emit({ running: true, index: Math.max(0, index), total: stops.length, slug });
    void hooks.travel(slug).then(() => {
      if (token !== sequence) return;
      hooks.present(slug);
      timer = window.setTimeout(() => {
        if (token !== sequence) return;
        goTo(index + 1);
      }, dwellMs);
    });
  };

  return {
    dwellMs,
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: (at = 0) => goTo(at),
    next: () => {
      if (state.running) goTo(state.index + 1);
    },
    prev: () => {
      if (state.running) goTo(Math.max(0, state.index - 1));
    },
    stop: () => end(false),
  };
}
