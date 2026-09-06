/*
 * Rendering quality (stage 7). `full` is the default; `lite` caps the
 * device pixel ratio at 1 and thins the ambient life. A device is lite
 * from the start when it looks low-powered, and any device drops to lite
 * when the watchdog sees frames staying over budget.
 */

export type Quality = 'full' | 'lite';

export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'full';
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  if (cores <= 4 || memory <= 4) return 'lite';
  if (coarse && window.innerWidth < 900) return 'lite';
  return 'full';
}

/** Trips once when the running interval between frames stays above `budgetMs` for `holdSeconds`. */
export class FrameWatchdog {
  private over = 0;
  private tripped = false;

  constructor(
    private readonly budgetMs = 28,
    private readonly holdSeconds = 3,
  ) {}

  /** Feed the running frame interval and the elapsed seconds; true on the frame the watchdog trips. */
  sample(intervalMs: number, dt: number): boolean {
    if (this.tripped) return false;
    this.over = intervalMs > this.budgetMs ? this.over + dt : Math.max(0, this.over - dt * 2);
    if (this.over >= this.holdSeconds) {
      this.tripped = true;
      return true;
    }
    return false;
  }
}
