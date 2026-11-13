import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Award, AwardPlace, StatusKey } from '../../data/mapAwards';
import { statusOf } from '../../data/mapAwards';
import { LAND_RINGS } from '../../utils/land';
import { invert, outline, project } from '../../utils/ortelius';
import type { XY } from '../../utils/ortelius';
import { CompassRose, Glyph } from './glyphs';
import './AwardsMap.css';

/*
 * The awards map, drawn as a 16th-century chart: Ortelius' oval projection on
 * aged paper, water-lined coasts, portolan wind lines, and ink symbols for the
 * pins. Coastlines are Natural Earth 110m from the repo; nothing is fetched.
 *
 * The chart is a canvas redrawn on every view change (about 2k coastline
 * points, cheap). Pins are real buttons laid over it, so they take keyboard
 * focus and read out to screen readers.
 */

/** Status pigments: verdigris, azurite, ochre and faded sepia, the colours a map colourist had. */
export const STATUS_COLOR: Record<StatusKey, string> = {
  open: '#3b7a52',
  running: '#3b7a52',
  firm: '#2d4f8c',
  expected: '#b07a22',
  tba: '#8f7148',
  closed: '#8a7c6a',
};

/** When a pin holds several programs, it takes the colour of the most urgent one. */
const URGENCY: StatusKey[] = ['open', 'running', 'firm', 'expected', 'tba', 'closed'];

const INK = '#2a1c10';
const SEA = '#ecdcb3';
const PAPER_OUT = '#d6bd8e';
const LAND = '#dcc28c';
const SERIF = "'Palatino Linotype', 'Book Antiqua', Palatino, 'Iowan Old Style', Georgia, serif";

const MIN_K = 0.85;
const MAX_K = 12;
/** Furthest the first framing may zoom in. */
const FIT_MAX_K = 3.2;
const LABEL_K = 2.4;

interface Props {
  awards: Award[];
  places: Record<string, AwardPlace>;
  selectedPlace: string | null;
  onSelectPlace: (key: string) => void;
  /** While true, a click on the map drops the new-entry pin instead of selecting. */
  pickMode?: boolean;
  picked?: { lng: number; lat: number } | null;
  onPick?: (p: { lng: number; lat: number }) => void;
  /** Pixels covered by the floating panel on the left, kept clear when framing. */
  leftInset?: number;
  /** Pixels covered by a bottom sheet (phones). */
  bottomInset?: number;
}

/** Centre of the view in projection units, and zoom over the whole-world fit. */
interface View {
  cx: number;
  cy: number;
  k: number;
}

interface Pin extends XY {
  key: string;
  name: string;
  detail: string;
  approx: boolean;
  role: AwardPlace['role'];
  count: number;
  color: string;
  titles: string[];
}

function toPins(awards: Award[], places: Record<string, AwardPlace>): Pin[] {
  const groups = new Map<string, Award[]>();
  for (const a of awards) {
    const list = groups.get(a.place) ?? [];
    list.push(a);
    groups.set(a.place, list);
  }
  const pins: Pin[] = [];
  for (const [key, list] of groups) {
    const place = places[key];
    if (!place) continue;
    const statuses = list.map((a) => statusOf(a));
    const top = URGENCY.find((s) => statuses.includes(s)) ?? 'tba';
    pins.push({
      key,
      name: place.name,
      detail: place.detail,
      approx: Boolean(place.approx),
      role: place.role,
      count: list.length,
      color: STATUS_COLOR[top],
      titles: list.map((a) => a.name),
      ...project(place.lng, place.lat),
    });
  }
  // Southern pins last so northern labels and seals overlap them, as on paper.
  return pins.sort((a, b) => b.y - a.y);
}

/* ---------------- Static geometry ---------------- */

interface Geometry {
  land: Path2D;
  oval: Path2D;
  grid: Path2D;
  circles: Path2D;
  equator: Path2D;
  winds: Path2D;
  halfWinds: Path2D;
  hubs: XY[];
}

let geometry: Geometry | null = null;

function line(path: Path2D, pts: XY[]) {
  pts.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
}

function meridian(lng: number): XY[] {
  const pts: XY[] = [];
  for (let lat = -90; lat <= 90; lat += 3) pts.push(project(lng, lat));
  return pts;
}

function parallel(lat: number): XY[] {
  const pts: XY[] = [];
  for (let lng = -180; lng <= 180; lng += 3) pts.push(project(lng, lat));
  return pts;
}

function getGeometry(): Geometry {
  if (geometry) return geometry;
  const land = new Path2D();
  for (const ring of LAND_RINGS) {
    line(
      land,
      ring.map((p) => project(p.lng, p.lat)),
    );
    land.closePath();
  }
  const oval = new Path2D();
  line(oval, outline());
  oval.closePath();

  const grid = new Path2D();
  for (let lng = -150; lng <= 150; lng += 30) if (lng !== 0) line(grid, meridian(lng));
  line(grid, meridian(0));
  for (const lat of [-60, -30, 30, 60]) line(grid, parallel(lat));
  const circles = new Path2D();
  for (const lat of [-66.56, -23.44, 23.44, 66.56]) line(circles, parallel(lat));
  const equator = new Path2D();
  line(equator, parallel(0));

  // Portolan wind lines: 16 rays from a few open-sea hubs. Principal winds in
  // ink, half winds in verdigris, as the chart makers coloured them.
  const hubs = [project(-36, 24), project(72, -16), project(-150, 6)];
  const winds = new Path2D();
  const halfWinds = new Path2D();
  for (const h of hubs) {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const target = i % 2 === 0 ? winds : halfWinds;
      target.moveTo(h.x, h.y);
      target.lineTo(h.x + 8 * Math.cos(a), h.y + 8 * Math.sin(a));
    }
  }
  geometry = { land, oval, grid, circles, equator, winds, halfWinds, hubs };
  return geometry;
}

const SEA_LABELS: { text: string; lng: number; lat: number; size: number; minK: number }[] = [
  { text: 'Atlantic Ocean', lng: -38, lat: 12, size: 15, minK: 0 },
  { text: 'Pacific Ocean', lng: -138, lat: -6, size: 15, minK: 0 },
  { text: 'Pacific Ocean', lng: 166, lat: 14, size: 13, minK: 0 },
  { text: 'Indian Ocean', lng: 76, lat: -26, size: 15, minK: 0 },
  { text: 'Southern Ocean', lng: 20, lat: -58, size: 13, minK: 0 },
  { text: 'Arctic Ocean', lng: 0, lat: 80, size: 12, minK: 1.4 },
  { text: 'Mediterranean Sea', lng: 17, lat: 34.2, size: 11, minK: 2.6 },
  { text: 'North Sea', lng: 3.5, lat: 56, size: 11, minK: 3.5 },
  { text: 'Caribbean Sea', lng: -74, lat: 14.5, size: 11, minK: 2.6 },
];

function drawChart(canvas: HTMLCanvasElement, w: number, h: number, view: View, z0: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof Path2D === 'undefined') return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(w * dpr);
  const ch = Math.round(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const g = getGeometry();
  const z = z0 * view.k;
  const px = (n: number) => n / z;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER_OUT;
  ctx.fillRect(0, 0, w, h);

  // Projection units to screen, y up.
  ctx.setTransform(dpr * z, 0, 0, -dpr * z, dpr * (w / 2 - view.cx * z), dpr * (h / 2 + view.cy * z));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillStyle = SEA;
  ctx.fill(g.oval);

  ctx.save();
  ctx.clip(g.oval);
  ctx.lineWidth = px(0.7);
  ctx.strokeStyle = 'rgba(42, 28, 16, 0.15)';
  ctx.stroke(g.winds);
  ctx.strokeStyle = 'rgba(59, 122, 82, 0.2)';
  ctx.stroke(g.halfWinds);

  ctx.lineWidth = px(0.6);
  ctx.strokeStyle = 'rgba(42, 28, 16, 0.22)';
  ctx.stroke(g.grid);
  ctx.setLineDash([px(5), px(4)]);
  ctx.stroke(g.circles);
  ctx.setLineDash([]);
  ctx.lineWidth = px(1.1);
  ctx.strokeStyle = 'rgba(42, 28, 16, 0.38)';
  ctx.stroke(g.equator);

  // Water lining: concentric ink lines echoing every coast, outermost first.
  // Each ring is a wide ink stroke with a slightly narrower sea stroke on top.
  const gap = 3.2;
  for (let i = 4; i >= 1; i--) {
    ctx.lineWidth = px(2 * i * gap);
    ctx.strokeStyle = `rgba(42, 28, 16, ${(0.5 - (i - 1) * 0.11).toFixed(2)})`;
    ctx.stroke(g.land);
    ctx.lineWidth = px(2 * i * gap - 1.5);
    ctx.strokeStyle = SEA;
    ctx.stroke(g.land);
  }

  ctx.fillStyle = LAND;
  ctx.fill(g.land, 'evenodd');

  // A colourist's wash along the inside of each coast.
  ctx.save();
  ctx.clip(g.land, 'evenodd');
  ctx.lineWidth = px(16);
  ctx.strokeStyle = 'rgba(128, 132, 62, 0.14)';
  ctx.stroke(g.land);
  ctx.lineWidth = px(6);
  ctx.strokeStyle = 'rgba(128, 132, 62, 0.2)';
  ctx.stroke(g.land);
  ctx.restore();

  ctx.lineWidth = px(1.15);
  ctx.strokeStyle = INK;
  ctx.stroke(g.land);

  // Small hub roses where the wind lines meet.
  for (const hub of g.hubs) {
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, px(5), 0, Math.PI * 2);
    ctx.fillStyle = SEA;
    ctx.fill();
    ctx.lineWidth = px(1);
    ctx.strokeStyle = 'rgba(42, 28, 16, 0.55)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, px(1.6), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(163, 52, 31, 0.8)';
    ctx.fill();
  }
  ctx.restore();

  // Neat line: a double rule around the oval.
  ctx.lineWidth = px(6);
  ctx.strokeStyle = INK;
  ctx.stroke(g.oval);
  ctx.lineWidth = px(3.4);
  ctx.strokeStyle = '#e8d5a8';
  ctx.stroke(g.oval);

  // Sea names, in screen space so they stay a readable size.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(42, 28, 16, 0.5)';
  const grow = Math.min(1.5, Math.pow(view.k, 0.25)) * Math.min(1, Math.max(0.75, w / 1100));
  for (const s of SEA_LABELS) {
    if (view.k < s.minK) continue;
    const p = project(s.lng, s.lat);
    const x = w / 2 + (p.x - view.cx) * z;
    const y = h / 2 - (p.y - view.cy) * z;
    if (x < -200 || x > w + 200 || y < -40 || y > h + 40) continue;
    ctx.font = `${Math.round(s.size * grow)}px ${SERIF}`;
    ctx.fillText(s.text, x, y);
  }
}

/* ---------------- Component ---------------- */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Bounds the view so some of the oval always stays on screen, with room to
 * slide it clear of the side panel or the phone's bottom sheet. */
let bounds = { w: 0, h: 0, z0: 1 };
const clampView = (v: View): View => {
  const k = Math.max(MIN_K, Math.min(MAX_K, v.k));
  const z = bounds.z0 * k;
  const mx = Math.PI + (0.3 * bounds.w) / z;
  const my = Math.PI / 2 + (0.45 * bounds.h) / z;
  return { cx: Math.max(-mx, Math.min(mx, v.cx)), cy: Math.max(-my, Math.min(my, v.cy)), k };
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function AwardsMap({
  awards,
  places,
  selectedPlace,
  onSelectPlace,
  pickMode = false,
  picked = null,
  onPick,
  leftInset = 0,
  bottomInset = 0,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ cx: 0.3, cy: 0.35, k: 1 });
  const [hover, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [intro, setIntro] = useState(true);
  const [pinDrag, setPinDrag] = useState<{ x: number; y: number } | null>(null);
  const [keyOpen, setKeyOpen] = useState<boolean | null>(null);
  const reduced = usePrefersReducedMotion();

  const z0 = size.w && size.h ? Math.max(1, Math.min((size.w - 32) / (2 * Math.PI), (size.h - 32) / Math.PI)) : 1;
  const z = z0 * view.k;
  const live = useRef({ view, size, z0, reduced, leftInset, bottomInset, pickMode, onPick, onSelectPlace });
  live.current = { view, size, z0, reduced, leftInset, bottomInset, pickMode, onPick, onSelectPlace };
  bounds = { w: size.w, h: size.h, z0 };

  const pins = useMemo(() => toPins(awards, places), [awards, places]);

  const toScreen = (p: XY) => ({ x: size.w / 2 + (p.x - view.cx) * z, y: size.h / 2 - (p.y - view.cy) * z });

  // Track the container size.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (canvasRef.current && size.w && size.h) drawChart(canvasRef.current, size.w, size.h, view, z0);
  }, [size, view, z0]);

  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), 3200);
    return () => window.clearTimeout(t);
  }, []);

  /* ----- View changes ----- */

  const anim = useRef<number | null>(null);
  /** Set once the visitor pans, zooms or selects; stops automatic reframing. */
  const touched = useRef(false);
  const stopAnim = () => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };
  const animateTo = useCallback((target: View, duration = 1100) => {
    stopAnim();
    touched.current = true;
    const goal = clampView(target);
    if (live.current.reduced) {
      setView(goal);
      return;
    }
    const from = live.current.view;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = ease(t);
      setView({
        cx: from.cx + (goal.cx - from.cx) * e,
        cy: from.cy + (goal.cy - from.cy) * e,
        k: from.k * Math.pow(goal.k / from.k, e),
      });
      anim.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => stopAnim, []);

  /** View that puts projection point `p` at the centre of the uncovered area. */
  const centreOn = useCallback((p: XY, k: number): View => {
    const { size: s, z0: base, leftInset: l, bottomInset: b } = live.current;
    const zz = base * k;
    return { cx: p.x - ((l + s.w) / 2 - s.w / 2) / zz, cy: p.y + ((s.h - b) / 2 - s.h / 2) / zz, k };
  }, []);

  const fitPins = useCallback(
    (list: Pin[]): View | null => {
      const { size: s, z0: base, leftInset: l, bottomInset: b } = live.current;
      if (!s.w || list.length < 2) return null;
      const xs = list.map((p) => p.x);
      const ys = list.map((p) => p.y);
      const bw = Math.max(0.2, Math.max(...xs) - Math.min(...xs));
      const bh = Math.max(0.2, Math.max(...ys) - Math.min(...ys));
      const pad = { top: 90, bottom: 70 + b, left: 50 + l, right: 70 };
      const zz = Math.min((s.w - pad.left - pad.right) / bw, (s.h - pad.top - pad.bottom) / bh);
      const k = Math.max(MIN_K, Math.min(FIT_MAX_K, zz / base));
      const mid = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 };
      const zk = base * k;
      // When the whole oval fits the free height, centre the oval instead of
      // the pins, so the chart doesn't float under a band of empty paper.
      const freeTop = 70;
      const freeH = s.h - b - freeTop;
      const cy = Math.PI * zk <= freeH ? (freeTop + freeH / 2 - s.h / 2) / zk : mid.y + ((pad.top + s.h - pad.bottom) / 2 - s.h / 2) / zk;
      return clampView({ cx: mid.x - ((pad.left + s.w - pad.right) / 2 - s.w / 2) / zk, cy, k });
    },
    [],
  );

  // Frame every pin on first data, and again if the box resizes before the
  // visitor has moved the map. Filter changes keep the view.
  const framedFor = useRef('');
  useLayoutEffect(() => {
    if (touched.current || !size.w) return;
    const sig = `${size.w}x${size.h}:${leftInset}:${bottomInset}`;
    if (framedFor.current === sig) return;
    const fit = fitPins(pins);
    if (!fit) return;
    framedFor.current = sig;
    setView(fit);
  }, [pins, size.w, size.h, leftInset, bottomInset, fitPins]);

  // Fly to the selected place.
  const ready = size.w > 0;
  useEffect(() => {
    if (!ready || !selectedPlace) return;
    const place = places[selectedPlace];
    if (!place) return;
    const k = Math.max(live.current.view.k, place.approx ? 2.6 : 4.2);
    animateTo(centreOn(project(place.lng, place.lat), k));
  }, [ready, selectedPlace, places, animateTo, centreOn]);

  const zoomAt = useCallback((factor: number, mx: number, my: number, animate = false) => {
    const { view: v, size: s, z0: base } = live.current;
    const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
    const before = base * v.k;
    const after = base * k;
    const ux = v.cx + (mx - s.w / 2) / before;
    const uy = v.cy - (my - s.h / 2) / before;
    const next = clampView({ cx: ux - (mx - s.w / 2) / after, cy: uy + (my - s.h / 2) / after, k });
    if (animate) animateTo(next, 450);
    else setView(next);
  }, [animateTo]);

  const pan = useCallback((dx: number, dy: number) => {
    setView((v) => {
      const zz = live.current.z0 * v.k;
      return clampView({ ...v, cx: v.cx - dx / zz, cy: v.cy + dy / zz });
    });
  }, []);

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnim();
      touched.current = true;
      const r = el.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 0.05 : 0.0018;
      zoomAt(Math.exp(-e.deltaY * unit), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  /* ----- Pointer gestures: drag to pan, pinch to zoom, click to pick ----- */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ sx: 0, sy: 0, lx: 0, ly: 0, dist: 0, moved: false });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-map-ui]')) return;
    stopAnim();
    touched.current = true;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size === 1) {
      Object.assign(g, { sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false });
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.dist = Math.hypot(a.x - b.x, a.y - b.y);
      g.lx = (a.x + b.x) / 2;
      g.ly = (a.y + b.y) / 2;
      g.moved = true;
      rootRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      pan(mx - g.lx, my - g.ly);
      if (g.dist > 0) zoomAt(dist / g.dist, mx, my);
      Object.assign(g, { dist, lx: mx, ly: my });
      return;
    }
    if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) > 4) {
      g.moved = true;
      setDragging(true);
      setHover(null);
      rootRef.current?.setPointerCapture(e.pointerId);
    }
    if (g.moved) pan(p.x - g.lx, p.y - g.ly);
    g.lx = p.x;
    g.ly = p.y;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const rest = [...pointers.current.values()][0];
    if (rest) Object.assign(gesture.current, { lx: rest.x, ly: rest.y });
    if (pointers.current.size === 0) setDragging(false);
  };

  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (gesture.current.moved) return;
    if ((e.target as HTMLElement).closest('[data-map-ui]')) return;
    const { pickMode: picking, onPick: pick } = live.current;
    if (!picking || !pick) return;
    const p = local(e);
    const at = invert(view.cx + (p.x - size.w / 2) / z, view.cy - (p.y - size.h / 2) / z);
    if (at) pick({ lng: +at.lng.toFixed(4), lat: +at.lat.toFixed(4) });
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-map-ui], .aw-mark')) return;
    const p = local(e);
    zoomAt(2, p.x, p.y, true);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const step = 80;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      stopAnim();
      touched.current = true;
      pan(...moves[e.key]);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomAt(1.6, size.w / 2, size.h / 2, true);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomAt(1 / 1.6, size.w / 2, size.h / 2, true);
    }
  };

  const zoomButton = (factor: number) => () => zoomAt(factor, (leftInset + size.w) / 2, (size.h - bottomInset) / 2, true);
  const showAll = () => {
    const fit = fitPins(pins.length > 1 ? pins : toPins(awards, places));
    animateTo(fit ?? { cx: 0, cy: 0, k: 1 });
  };

  /* ----- New-entry pin, dragged with its own pointer capture ----- */

  const pinPos = pinDrag ?? (picked ? toScreen(project(picked.lng, picked.lat)) : null);
  const onPinDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPinDrag(local(e));
  };
  const onPinMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pinDrag) setPinDrag(local(e));
  };
  const onPinUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!pinDrag) return;
    const at = invert(view.cx + (pinDrag.x - size.w / 2) / z, view.cy - (pinDrag.y - size.h / 2) / z);
    setPinDrag(null);
    if (at) onPick?.({ lng: +at.lng.toFixed(4), lat: +at.lat.toFixed(4) });
  };

  /* ----- Render ----- */

  // Name labels, placed greedily so they never overprint each other or a
  // neighbouring symbol: the selected and hovered places first, then the
  // places with the most programs.
  const labelled = new Set<string>();
  {
    const boxes: { l: number; t: number; r: number; b: number }[] = [];
    const hit = (a: (typeof boxes)[number]) => boxes.some((o) => a.l < o.r && a.r > o.l && a.t < o.b && a.b > o.t);
    const placed = pins.map((p) => ({ p, at: toScreen(p) }));
    for (const { at } of placed) boxes.push({ l: at.x - 13, t: at.y - 13, r: at.x + 13, b: at.y + 13 });
    const rank = (p: Pin) => (p.key === selectedPlace ? 3 : p.key === hover ? 2 : 0) * 1000 + p.count;
    for (const { p, at } of [...placed].sort((a, b) => rank(b.p) - rank(a.p))) {
      if (!(view.k >= LABEL_K || p.key === selectedPlace || p.key === hover)) continue;
      const half = p.name.length * 3.9 + 4;
      const box = { l: at.x - half, t: at.y + 18, r: at.x + half, b: at.y + 36 };
      if (p.key !== selectedPlace && hit(box)) continue;
      boxes.push(box);
      labelled.add(p.key);
    }
  }

  const tipPin = !pickMode && !dragging && hover ? pins.find((p) => p.key === hover) : undefined;
  const tipAt = tipPin ? toScreen(tipPin) : null;
  const tipBelow = tipAt ? tipAt.y < 230 : false;
  const tipLeft = tipAt ? Math.max(140, Math.min(size.w - 140, tipAt.x)) : 0;
  const roseSize = size.w < 640 ? 64 : 104;
  // The key starts open on wide screens and folded on phones, where it would cover the chart.
  const showKey = keyOpen ?? size.w >= 640;

  return (
    <div
      ref={rootRef}
      className={`awards-map-root ${intro && !reduced ? 'aw-intro' : ''} ${pickMode ? 'is-picking' : ''} ${dragging ? 'is-dragging' : ''}`}
      role="region"
      aria-label="Map of award and competition locations"
      aria-describedby="aw-map-help"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <p id="aw-map-help" className="sr-only">
        Drag or use the arrow keys to move the map, plus and minus to zoom. Tab to reach each place.
      </p>
      <canvas ref={canvasRef} className="awards-canvas" style={{ width: size.w, height: size.h }} aria-hidden="true" />

      <div className="aw-marks">
        {pins.map((p, i) => {
          const at = toScreen(p);
          if (at.x < -60 || at.x > size.w + 60 || at.y < -60 || at.y > size.h + 60) return null;
          const glyph = Math.round(Math.min(40, 24 + 4 * Math.sqrt(p.count)));
          const selected = p.key === selectedPlace;
          const showLabel = labelled.has(p.key);
          return (
            <button
              key={p.key}
              type="button"
              className="aw-mark"
              data-role={p.role}
              aria-current={selected ? 'true' : undefined}
              aria-label={`${p.name}, ${p.detail}: ${p.count} ${p.count === 1 ? 'program' : 'programs'}${p.approx ? ', approximate place' : ''}`}
              style={{ transform: `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`, '--c': p.color, '--i': i } as CSSProperties}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(p.key)}
              onPointerLeave={() => setHover((h) => (h === p.key ? null : h))}
              onFocus={() => setHover(p.key)}
              onBlur={() => setHover((h) => (h === p.key ? null : h))}
              onClick={() => {
                if (gesture.current.moved || live.current.pickMode) return;
                onSelectPlace(p.key);
              }}
            >
              <span className="aw-mark-inner">
                <Glyph kind={p.role} approx={p.approx} size={glyph} />
                {p.count > 1 && <span className="aw-count">{p.count}</span>}
              </span>
              {showLabel && <span className="aw-label">{p.name}</span>}
            </button>
          );
        })}
      </div>

      {pickMode && pinPos && (
        <div
          className="awards-new-pin"
          role="img"
          aria-label="New award location"
          data-map-ui
          style={{ transform: `translate3d(${pinPos.x}px, ${pinPos.y}px, 0)` }}
          onPointerDown={onPinDown}
          onPointerMove={onPinMove}
          onPointerUp={onPinUp}
          onPointerCancel={onPinUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <div className="aw-paper" aria-hidden="true" />
      <div className="aw-light" aria-hidden="true" />
      <div className="aw-vignette" aria-hidden="true" />
      <div className="aw-frame" aria-hidden="true" />

      <div className="aw-rose-wrap" style={{ top: size.w < 640 ? 64 : 76 }} aria-hidden="true">
        <CompassRose size={roseSize} />
      </div>

      {tipPin && tipAt && (
        <div
          className={`awards-popup ${tipBelow ? 'is-below' : ''}`}
          role="tooltip"
          style={{ left: tipLeft, top: tipBelow ? tipAt.y + 26 : tipAt.y - 26 }}
        >
          <strong>{tipPin.name}</strong>
          <span className="aw-pop-meta">
            {tipPin.count} {tipPin.count === 1 ? 'program' : 'programs'} · {tipPin.detail}
            {tipPin.approx ? ' (approximate place)' : ''}
          </span>
          <ul>
            {tipPin.titles.slice(0, 6).map((t) => (
              <li key={t}>{t}</li>
            ))}
            {tipPin.count > 6 && <li>+ {tipPin.count - 6} more</li>}
          </ul>
        </div>
      )}

      <div className="aw-key-wrap" data-map-ui style={{ left: leftInset + 18, bottom: bottomInset + 18 }}>
        {showKey ? (
          <div className="aw-key" id="aw-key">
            <button type="button" className="aw-key-close" onClick={() => setKeyOpen(false)} aria-label="Hide the key">
              ×
            </button>
            <span className="aw-key-row">
              <span className="aw-key-item">
                <Glyph kind="venue" size={20} /> Venue
              </span>
              <span className="aw-key-item">
                <Glyph kind="organizer" size={20} /> Organizer
              </span>
              <span className="aw-key-item">
                <Glyph kind="organizer" approx size={20} /> Country only
              </span>
            </span>
            <span className="aw-key-row">
              {(
                [
                  ['open', 'Open'],
                  ['firm', 'Date set'],
                  ['expected', 'Expected'],
                  ['closed', 'Closed'],
                ] as [StatusKey, string][]
              ).map(([k, text]) => (
                <span key={k} className="aw-key-item">
                  <span className="aw-swatch" style={{ background: STATUS_COLOR[k] }} />
                  {text}
                </span>
              ))}
            </span>
          </div>
        ) : (
          <button type="button" className="aw-key-toggle" aria-expanded={false} onClick={() => setKeyOpen(true)}>
            <Glyph kind="venue" size={18} /> Key
          </button>
        )}
      </div>

      <div className="aw-controls" data-map-ui style={{ bottom: bottomInset + 18 }}>
        <button type="button" onClick={zoomButton(1.6)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={zoomButton(1 / 1.6)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={showAll} aria-label="Show every place">
          <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <ellipse cx="10" cy="10" rx="8" ry="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10 5v10M2 10h16" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
      <p className="aw-credit" style={{ bottom: bottomInset + 18 + 3 * 39 + 10 }}>
        Coasts: Natural Earth · Ortelius oval projection
      </p>
    </div>
  );
}
