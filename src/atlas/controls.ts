import { clampCamera, zoomAround, type CameraAnimator, type Point, type ViewStore } from './camera.ts';

/*
 * Pointer, wheel and keyboard gestures on the atlas container, translated
 * into camera moves on the view store. Nothing here knows about
 * settlements: taps and hover positions are handed back through callbacks
 * and hit-tested by the view.
 *
 *   drag            pan (mouse or one finger)
 *   two fingers     pinch zoom around the midpoint, plus pan
 *   wheel           zoom around the cursor; a trackpad pinch arrives as
 *                   ctrl+wheel and is treated the same
 *   double-click    zoom in around the cursor
 *   arrows, WASD    pan; + and - zoom around the centre
 */

export interface ControlCallbacks {
  /** The pointer moved without a button down (mouse), or left the container (null). */
  onHoverMove(point: Point | null): void;
  /** A press and release without dragging. */
  onTap(point: Point, pointerType: string): void;
  /** Escape was pressed while the map had focus. */
  onEscape(): void;
}

/** Movement under this, in CSS pixels, still counts as a tap. */
const TAP_SLOP = 5;
const WHEEL_SENSITIVITY = 0.0016;
const KEY_PAN_PX = 90;
const KEY_ZOOM = 1.5;
const DOUBLE_CLICK_ZOOM = 1.9;

/** Elements that own their own pointer behaviour; gestures starting on them are left alone. */
const OWN_POINTER = '.atlas-hud, .atlas-tooltip, .atlas-label, .atlas-sr-list, button, a';

export function attachCameraControls(
  container: HTMLElement,
  store: ViewStore,
  animator: CameraAnimator,
  callbacks: ControlCallbacks,
): () => void {
  const pointers = new Map<number, Point>();
  let pressed = false;
  let dragging = false;
  let pressStart: Point | null = null;
  let last: Point | null = null;
  let pinchDistance = 0;

  const local = (event: PointerEvent | MouseEvent | WheelEvent): Point => {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const owned = (event: Event): boolean =>
    event.target instanceof Element && event.target.closest(OWN_POINTER) !== null;
  const setCamera = (camera: { x: number; y: number; zoom: number }): void => {
    store.set({ camera: clampCamera(camera, store.get().viewport, animator.bounds) });
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (owned(event)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    try {
      container.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone, or a synthetic event: the drag still works without capture.
    }
    const point = local(event);
    pointers.set(event.pointerId, point);
    animator.cancel();
    if (pointers.size === 1) {
      pressed = true;
      dragging = false;
      pressStart = point;
      last = point;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      dragging = true;
    }
    container.focus({ preventScroll: true });
  };

  const onPointerMove = (event: PointerEvent): void => {
    const point = local(event);
    if (!pointers.has(event.pointerId)) {
      if (event.pointerType === 'mouse' && !pressed) {
        const target = event.target instanceof Element ? event.target : null;
        // The card and the labels manage the hover themselves; leave it alone while over them.
        if (target?.closest('.atlas-tooltip, .atlas-label')) return;
        callbacks.onHoverMove(owned(event) ? null : point);
      }
      return;
    }
    pointers.set(event.pointerId, point);
    const { camera, viewport } = store.get();

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const factor = pinchDistance > 0 ? distance / pinchDistance : 1;
      pinchDistance = distance;
      const zoomed = zoomAround(camera, viewport, mid.x, mid.y, factor);
      if (last) {
        zoomed.x -= (mid.x - last.x) / zoomed.zoom;
        zoomed.y -= (mid.y - last.y) / zoomed.zoom;
      }
      last = mid;
      setCamera(zoomed);
      return;
    }

    if (!pressed || !last || !pressStart) return;
    if (!dragging && Math.hypot(point.x - pressStart.x, point.y - pressStart.y) > TAP_SLOP) dragging = true;
    if (dragging) {
      setCamera({
        x: camera.x - (point.x - last.x) / camera.zoom,
        y: camera.y - (point.y - last.y) / camera.zoom,
        zoom: camera.zoom,
      });
    }
    last = point;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    const point = local(event);
    pointers.delete(event.pointerId);
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    if (pointers.size === 0) {
      if (pressed && !dragging && event.type === 'pointerup') callbacks.onTap(point, event.pointerType);
      pressed = false;
      dragging = false;
      pressStart = null;
      last = null;
    } else {
      // One finger of a pinch lifted: continue as a drag from the other.
      last = [...pointers.values()][0];
      pinchDistance = 0;
    }
  };

  const onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && !pressed) callbacks.onHoverMove(null);
  };

  const onWheel = (event: WheelEvent): void => {
    if (owned(event) && !(event.target instanceof Element && event.target.closest('.atlas-label'))) return;
    event.preventDefault();
    animator.cancel();
    const { camera, viewport } = store.get();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 100 : event.deltaY;
    const factor = Math.exp(-delta * WHEEL_SENSITIVITY);
    const point = local(event);
    setCamera(zoomAround(camera, viewport, point.x, point.y, factor));
  };

  const onDoubleClick = (event: MouseEvent): void => {
    if (owned(event)) return;
    event.preventDefault();
    const { camera, viewport } = store.get();
    const point = local(event);
    void animator.to(zoomAround(camera, viewport, point.x, point.y, DOUBLE_CLICK_ZOOM), 380);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== container) return;
    const { camera, viewport } = store.get();
    const pan = (dx: number, dy: number): void => {
      event.preventDefault();
      void animator.to({ x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom, zoom: camera.zoom }, 180);
    };
    const zoom = (factor: number): void => {
      event.preventDefault();
      void animator.to(zoomAround(camera, viewport, viewport.width / 2, viewport.height / 2, factor), 240);
    };
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        pan(-KEY_PAN_PX, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        pan(KEY_PAN_PX, 0);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        pan(0, -KEY_PAN_PX);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        pan(0, KEY_PAN_PX);
        break;
      case '+':
      case '=':
        zoom(KEY_ZOOM);
        break;
      case '-':
      case '_':
        zoom(1 / KEY_ZOOM);
        break;
      case 'Escape':
        callbacks.onEscape();
        break;
      default:
    }
  };

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('pointerleave', onPointerLeave);
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('dblclick', onDoubleClick);
  container.addEventListener('keydown', onKeyDown);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('pointerleave', onPointerLeave);
    container.removeEventListener('wheel', onWheel);
    container.removeEventListener('dblclick', onDoubleClick);
    container.removeEventListener('keydown', onKeyDown);
  };
}
