import { useEffect, useRef, useState } from 'react';
import { formatCoordinates } from '../../utils/coordinates';

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], [role="link"], input, textarea, select, label, .maplibregl-canvas, .map-origin-marker, .map-context-marker';

/* Where the system I-beam takes over (global.css keeps `cursor: text` there). */
const TEXT_FIELD_SELECTOR =
  "input:not([type='checkbox'], [type='radio'], [type='range'], [type='button'], [type='submit']), textarea, [contenteditable='true']";

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Fine pointers only, and never when the user has asked the OS for more
    // contrast or forced colours: a drawn cursor ignores both, and their size.
    const optOut = '(forced-colors: active), (prefers-contrast: more)';
    if (!window.matchMedia('(pointer: fine)').matches || window.matchMedia(optOut).matches) return;
    setEnabled(true);
    document.documentElement.classList.add('has-custom-cursor');

    // Pointer events can arrive several times a frame; paint once per frame.
    let pending: MouseEvent | null = null;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const el = cursorRef.current;
      const e = pending;
      if (!el || !e) return;
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const target = e.target as Element | null;
      el.classList.toggle('is-hovering', Boolean(target?.closest?.(INTERACTIVE_SELECTOR)));
      el.classList.toggle('is-over-text', Boolean(target?.matches?.(TEXT_FIELD_SELECTOR)));
      const coordEl = coordRef.current;
      if (coordEl) {
        const lat = 90 - (e.clientY / window.innerHeight) * 180;
        const lng = (e.clientX / window.innerWidth) * 360 - 180;
        coordEl.textContent = formatCoordinates(lat, lng);
      }
    };
    const onMove = (e: MouseEvent) => {
      pending = e;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onDown = () => cursorRef.current?.classList.add('is-pressed');
    const onUp = () => cursorRef.current?.classList.remove('is-pressed');
    const onLeaveWindow = (e: MouseEvent) => {
      if (e.relatedTarget === null && cursorRef.current) {
        cursorRef.current.style.transform = 'translate3d(-100px, -100px, 0)';
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseout', onLeaveWindow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseout', onLeaveWindow);
      document.documentElement.classList.remove('has-custom-cursor');
    };
  }, []);

  if (!enabled) return null;

  return (
    <div ref={cursorRef} aria-hidden="true" className="cursor-pointer-el">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2 1.5 L2 16 L6.4 11.8 L13.5 11.2 Z" />
      </svg>
      <span ref={coordRef} className="cursor-coord" />
    </div>
  );
}
