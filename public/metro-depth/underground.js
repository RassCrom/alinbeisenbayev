// Underground view: a three.js custom layer inside MapLibre that draws each line's tunnels at the depth
// of its stations, a shaft from the street to every platform, depth planes, and a see-through ground on top.
// Geometry is in metres around the city's centre (x east, y north, z up), placed with one matrix.
// Labels (platform names, plane depths) are HTML, projected with the same matrix after each frame.
import * as THREE from './vendor/three.module.js';

export function createUnderground(map, maplibregl, { depthColor, labelsEl }) {
  let scene, camera, renderer, root = null, M = null;
  let builtZoom = 0;
  let data = null, exag = 20, enabled = false, hidden = new Set(), origin = null, unit = 1, timer = 0;
  let colorMode = 'depth', hoverLine = null, hoverI = null;
  // surface: (lon, lat) -> street height in metres above sea level, or null for a flat street at 0.
  // With a surface, everything sits at (street height - depth) x exaggeration, the same scale MapLibre's terrain uses.
  let surface = null, names = true;
  // reveal: (opening day) -> 0..1, how far that piece has been built at the current moment of the growth timeline.
  // null shows everything. Station days come from data.stations[i]._t, track days per vertex from data._trackT.
  let reveal = null, dated = [];
  let plats = [], planes = [], tunnelMats = {}, labelFrame = 0;

  const layer = {
    id: 'underground', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 1.7));
      const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(0.4, -0.7, 1); scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(gl, args) {
      if (!enabled || !root) return;
      const world = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const local = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new THREE.Vector3(unit, -unit, unit));
      camera.projectionMatrix = world.multiply(local);
      M = camera.projectionMatrix.elements.slice();
      renderer.resetState();
      renderer.clearDepth();
      renderer.render(scene, camera);
      if (!labelFrame) labelFrame = requestAnimationFrame(layoutLabels);
    },
  };

  const toLocal = (lon, lat) => {
    const c = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0);
    return [(c.x - origin.x) / unit, -(c.y - origin.y) / unit];
  };

  // local metres -> CSS pixels on the map canvas (null when behind the camera)
  function project(x, y, z) {
    if (!M) return null;
    const e = M;
    const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (w <= 0) return null;
    const cv = map.getCanvas();
    return [(cx / w + 1) / 2 * cv.clientWidth, (1 - cy / w) / 2 * cv.clientHeight];
  }

  function clear() {
    if (!root) return;
    root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    scene.remove(root); root = null;
    plats = []; planes = []; tunnelMats = {}; dated = [];
    labelsEl.innerHTML = '';
  }

  const platColor = (p) => (colorMode === 'line' ? p.lineColor : depthColor(p.d));

  function build() {
    clear();
    if (!data || !scene) return;
    const [w, s, e, n] = data.bbox;
    const o = maplibregl.MercatorCoordinate.fromLngLat([(w + e) / 2, (s + n) / 2], 0);
    origin = o; unit = o.meterInMercatorCoordinateUnits();
    root = new THREE.Group();

    const [x0, y0] = toLocal(w, s), [x1, y1] = toLocal(e, n);
    const extent = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 2000);
    // tunnel radius in metres: about 2.5 screen pixels at the current zoom
    builtZoom = map.getZoom();
    const mpp = 78271.5 * Math.cos(((s + n) / 2) * Math.PI / 180) / 2 ** builtZoom;
    const r = Math.min(80, Math.max(2, mpp * 2.5));
    const z = (d) => -d * exag;
    const street = (lon, lat) => (surface ? surface(lon, lat) : 0);

    const lineColor = Object.fromEntries(data.lines.map((l) => [l.id, l.color]));
    const byLine = {};
    data.stations.forEach((st, i) => {
      if (hidden.has(st.line)) return;
      const [x, y] = toLocal(st.lon, st.lat);
      const e = street(st.lon, st.lat);
      // a: platform height above sea level (or below the street when there is no surface)
      (byLine[st.line] ||= []).push({ x, y, d: st.depth, e, a: e - st.depth, st, i });
    });

    // tunnels: every track vertex takes the platform height of its nearby stations on the same line (inverse-distance, two nearest)
    for (const line of data.lines) {
      const sts = byLine[line.id];
      if (!sts?.length) continue;
      const mat = new THREE.MeshLambertMaterial({ color: line.color, transparent: true, opacity: 1 });
      tunnelMats[line.id] = mat;
      line.coords.forEach((path, pi) => {
        const days = data._trackT?.[line.id]?.[pi];
        const pts = [], pd = [];
        for (let vi = 0; vi < path.length; vi++) {
          const [lon, lat] = path[vi];
          const [x, y] = toLocal(lon, lat);
          let a = null, b = null;
          for (const s2 of sts) {
            const dd = (s2.x - x) ** 2 + (s2.y - y) ** 2;
            if (!a || dd < a.dd) { b = a; a = { s: s2, dd }; } else if (!b || dd < b.dd) b = { s: s2, dd };
          }
          let h = a.s.a;
          if (b && a.dd > 1) { const wa = 1 / a.dd, wb = 1 / b.dd; h = (a.s.a * wa + b.s.a * wb) / (wa + wb); }
          const p = new THREE.Vector3(x, y, h * exag);
          if (!pts.length || p.distanceTo(pts[pts.length - 1]) > 2) { pts.push(p); pd.push(days ? days[vi] : 0); }
        }
        if (pts.length < 2) return;
        // a run of segments that open on the same day becomes one tube
        let start = 0;
        const segDay = (i) => Math.max(pd[i - 1] ?? 0, pd[i] ?? 0);
        for (let i = 1; i < pts.length; i++) {
          if (i < pts.length - 1 && segDay(i + 1) === segDay(start + 1)) continue;
          // a new stretch grows out of the older track it continues: from its start, or from its end
          const day = segDay(start + 1);
          const before = start > 0 ? segDay(start) : Infinity, after = i + 1 < pts.length ? segDay(i + 1) : Infinity;
          const run = pts.slice(start, i + 1);
          if (!(before < day) && after < day) run.reverse();
          const curve = new THREE.CurvePath();
          for (let k = 1; k < run.length; k++) curve.add(new THREE.LineCurve3(run[k - 1], run[k]));
          const segs = Math.min((i - start) * 3, 3000);
          const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 6, false), mat);
          mesh.userData = { t: day, kind: 'tube', segs };
          root.add(mesh); dated.push(mesh);
          start = i;
        }
      });
    }

    // shafts and platforms; estimated depths are drawn ghosted
    const shaftMat = new THREE.MeshLambertMaterial({ color: 0xf3ebdf, transparent: true, opacity: 0.45, depthWrite: false });
    const platGeo = new THREE.BoxGeometry(r * 3.6, r * 3.6, r * 1.4);
    const seen = new Set();
    let maxD = 0;
    for (const sts of Object.values(byLine)) for (const p of sts) {
      if (p.d <= 0) continue;
      const key = p.st.name + '|' + p.st.line;
      if (seen.has(key)) continue; seen.add(key);
      maxD = Math.max(maxD, p.d);
      const h = p.d * exag;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, h, 8), shaftMat);
      shaft.rotation.x = Math.PI / 2; shaft.position.set(p.x, p.y, (p.e - p.d / 2) * exag);
      const item = { x: p.x, y: p.y, z: p.a * exag, d: p.d, i: p.i, line: p.st.line, name: p.st.name, est: p.st.est, lineColor: lineColor[p.st.line], t: p.st._t ?? 0 };
      shaft.userData = { t: item.t, kind: 'shaft', top: p.e * exag, h }; dated.push(shaft);
      const mat = new THREE.MeshLambertMaterial({ color: platColor(item), transparent: true, opacity: p.st.est ? 0.45 : 1 });
      const plat = new THREE.Mesh(platGeo, mat);
      plat.position.set(p.x, p.y, item.z);
      item.mesh = plat; plat.userData = { t: item.t, kind: 'plat', reveal: 1 }; dated.push(plat);
      plats.push(item);
      root.add(shaft, plat);
    }
    plats.sort((a, b) => b.d - a.d);

    // depth planes every 25 / 10 / 5 m, so the eye can measure a tunnel against them
    const pad = extent * 0.25;
    const pw = Math.abs(x1 - x0) + pad * 2, ph = Math.abs(y1 - y0) + pad * 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const step = maxD > 60 ? 25 : maxD > 30 ? 10 : 5;
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xf3ebdf, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xf3ebdf, transparent: true, opacity: 0.3 });
    for (let d = step; !surface && d <= maxD + step * 0.5; d += step) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), planeMat);
      plane.position.set(cx, cy, z(d)); plane.renderOrder = 5;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(cx + a * pw / 2, cy + b * ph / 2, z(d)));
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners), edgeMat);
      root.add(plane, edge);
      planes.push({ d, corners });
    }

    // the street: a dark see-through sheet at z = 0, drawn last so everything below it reads as underground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, ph),
      new THREE.MeshBasicMaterial({ color: 0x14110f, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    );
    ground.position.set(cx, cy, 0); ground.renderOrder = 10;
    if (!surface) root.add(ground);
    else {
      // the street as a relief sheet: same heights and exaggeration as the terrain, see-through, with a light grid,
      // so it reads from above, from the side and from below (MapLibre's own terrain is not drawn from underneath)
      const nx = 140, ny = Math.max(20, Math.round(140 * ph / pw));
      const geo = new THREE.PlaneGeometry(pw, ph, nx, ny), pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const lx = cx + pos.getX(k), ly = cy + pos.getY(k);
        const ll = new maplibregl.MercatorCoordinate(origin.x + lx * unit, origin.y - ly * unit, 0).toLngLat();
        pos.setXYZ(k, lx, ly, surface(ll.lng, ll.lat) * exag);
      }
      geo.computeVertexNormals();
      const sheet = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x8a7258, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide }));
      sheet.renderOrder = 10;
      // contour-like grid: only every 7th row and column of the sheet, as lines along the ground
      const gp = [], cols = nx + 1, rows = ny + 1, step = 7;
      const v = (i, j) => { const k = j * cols + i; return [pos.getX(k), pos.getY(k), pos.getZ(k)]; };
      for (let j = 0; j < rows; j += step) for (let i = 0; i < cols - 1; i++) gp.push(...v(i, j), ...v(i + 1, j));
      for (let i = 0; i < cols; i += step) for (let j = 0; j < rows - 1; j++) gp.push(...v(i, j), ...v(i, j + 1));
      const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
      const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0xf3ebdf, transparent: true, opacity: 0.16, depthWrite: false }));
      grid.renderOrder = 11;
      root.add(sheet, grid);
    }

    // label elements: one per platform, one per plane
    for (const p of plats) {
      const el = document.createElement('div');
      el.className = 'ug-lbl' + (p.est ? ' est' : '');
      el.innerHTML = `<b></b><span></span>`;
      el.firstChild.textContent = p.name;
      el.lastChild.textContent = ` ${Math.round(p.d * 10) / 10} m`;
      labelsEl.appendChild(el); p.el = el;
    }
    for (const pl of planes) {
      const el = document.createElement('div');
      el.className = 'ug-plane';
      el.textContent = `${pl.d} m`;
      labelsEl.appendChild(el); pl.el = el;
    }
    applyReveal();
    scene.add(root);
    map.triggerRepaint();
  }

  // greedy label placement: deepest first, skip anything that would overlap a placed label
  function layoutLabels() {
    labelFrame = 0;
    labelsEl.hidden = !enabled;
    if (!enabled || !M) return;
    const W = map.getCanvas().clientWidth, H = map.getCanvas().clientHeight;
    for (const pl of planes) {
      let best = null;
      for (const c of pl.corners) { const s = project(c.x, c.y, c.z); if (s && (!best || s[1] > best[1])) best = s; }
      const show = best && best[0] > 0 && best[0] < W && best[1] > 0 && best[1] < H;
      pl.el.style.opacity = show ? 1 : 0;
      if (show) pl.el.style.transform = `translate(${best[0].toFixed(1)}px,${best[1].toFixed(1)}px) translate(-50%,-120%)`;
    }
    const placed = [];
    const order = hoverI == null ? plats : [...plats].sort((a, b) => (b.i === hoverI) - (a.i === hoverI));
    for (const p of order) {
      const s = project(p.x, p.y, p.z);
      let show = !!s && s[0] > -40 && s[0] < W && s[1] > 0 && s[1] < H;
      if (show && hoverLine && p.line !== hoverLine) show = false;
      if (show && !names && p.i !== hoverI) show = false;
      if (show && reveal && p.mesh.userData.reveal < 0.9) show = false;
      if (show) {
        p.w ||= p.el.offsetWidth; p.h ||= p.el.offsetHeight;
        const r = [s[0] + 8, s[1] - p.h / 2, s[0] + 8 + p.w, s[1] + p.h / 2];
        if (p.i !== hoverI && placed.some((q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]))) show = false;
        else { placed.push([r[0] - 2, r[1] - 1, r[2] + 2, r[3] + 1]); p.el.style.transform = `translate(${r[0].toFixed(1)}px,${r[1].toFixed(1)}px)`; }
      }
      p.el.style.opacity = show ? 1 : 0;
      p.el.classList.toggle('on', p.i === hoverI);
    }
  }

  function applyHover() {
    for (const [line, mat] of Object.entries(tunnelMats)) mat.opacity = !hoverLine || line === hoverLine ? 1 : 0.16;
    for (const p of plats) {
      const s = (p.i === hoverI ? 1.8 : 1) * Math.max(p.mesh.userData.reveal ?? 1, 1e-3);
      p.mesh.scale.set(s, s, s);
      p.mesh.material.opacity = (hoverLine && p.line !== hoverLine ? 0.2 : 1) * (p.est ? 0.45 : 1);
    }
    map.triggerRepaint();
  }

  // tunnels draw out along their length, shafts drill down from the street, platforms swell in at the end
  function applyReveal() {
    for (const m of dated) {
      const u = m.userData, f = reveal ? reveal(u.t) : 1;
      if (u.kind === 'tube') {
        m.visible = f > 0;
        m.geometry.setDrawRange(0, f >= 1 ? Infinity : Math.max(1, Math.ceil(f * u.segs)) * 36);
      } else if (u.kind === 'shaft') {
        const k = Math.max(f, 1e-3);
        m.visible = f > 0; m.scale.set(1, k, 1); m.position.z = u.top - u.h * k / 2;
      } else if (u.kind === 'plat') {
        const k = f < 0.6 ? 0 : Math.min(1, (f - 0.6) / 0.4);
        u.reveal = k * (2 - k); m.visible = u.reveal > 0;
      }
    }
    applyHover();
    if (!labelFrame) labelFrame = requestAnimationFrame(layoutLabels);
  }

  const rebuildSoon = () => { clearTimeout(timer); timer = setTimeout(build, 60); };
  map.on('zoomend', () => { if (data && Math.abs(map.getZoom() - builtZoom) > 0.6) rebuildSoon(); });

  return {
    layer,
    setCity(c) { data = c; hidden = new Set(); hoverLine = hoverI = null; build(); },
    setHidden(h) { hidden = new Set(h); rebuildSoon(); },
    setExaggeration(x) { exag = x; rebuildSoon(); },
    setEnabled(on) { enabled = on; labelsEl.hidden = !on; map.triggerRepaint(); },
    setReveal(fn) { reveal = fn; applyReveal(); },
    setSurface(fn) { surface = fn; rebuildSoon(); },
    setNames(on) { names = on; map.triggerRepaint(); if (!labelFrame) labelFrame = requestAnimationFrame(layoutLabels); },
    setColorMode(m) { colorMode = m; for (const p of plats) p.mesh.material.color.set(platColor(p)); map.triggerRepaint(); },
    setHover(line, i) { if (line === hoverLine && i === hoverI) return; hoverLine = line; hoverI = i; applyHover(); },
    // nearest platform to a screen point, within 16 px
    pick(px, py) {
      if (!enabled || !M) return null;
      let best = null, bd = 16 * 16;
      for (const p of plats) {
        const s = project(p.x, p.y, p.z); if (!s) continue;
        const d = (s[0] - px) ** 2 + (s[1] - py) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      return best && { i: best.i, line: best.line };
    },
    get enabled() { return enabled; },
    get exaggeration() { return exag; },
  };
}
