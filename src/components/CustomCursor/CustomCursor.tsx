import { useEffect, useRef, useState } from 'react';

const fmtCoord = (lat: number, lng: number): string =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`;

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], [role="link"], input, textarea, select, label, .maplibregl-canvas, .map-origin-marker, .map-context-marker';

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    setEnabled(true);
    document.documentElement.classList.add('has-custom-cursor');

    const onMove = (e: MouseEvent) => {
      const el = cursorRef.current;
      if (!el) return;
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const target = e.target as Element | null;
      el.classList.toggle('is-hovering', Boolean(target?.closest?.(INTERACTIVE_SELECTOR)));
      const coordEl = coordRef.current;
      if (coordEl) {
        const lat = 90 - (e.clientY / window.innerHeight) * 180;
        const lng = (e.clientX / window.innerWidth) * 360 - 180;
        coordEl.textContent = fmtCoord(lat, lng);
      }
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
