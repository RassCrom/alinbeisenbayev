// Builds public/metro-depth/data/*.json from the station-depth research in metro_anim-revert.
// node scripts/build-metro-depth.mjs [path-to-metro-depth-folder]
// Depth convention in the output: metres below street level, positive down. Negative = above the street (viaduct).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2] || 'D:/projects/web/metro_anim-revert/metro-depth';
const OUT = 'public/metro-depth/data';
mkdirSync(OUT, { recursive: true });
const read = (p) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const r1 = (n) => Math.round(n * 10) / 10;
const xy = (c) => [r5(c[0]), r5(c[1])];

// summary rows from the research table (DEPTH-AVAILABILITY.md, 2026-11-14)
const META = {
  kyiv: { name: 'Kyiv', status: 'sourced', stationsLabel: '52 (46 underground)', confirmed: '51', estimated: '1', source: 'Dobrov catalogue', note: 'Arsenalna is the deepest metro station in the world.' },
  'st-petersburg': { name: 'St Petersburg', status: 'sourced', stationsLabel: '75 (70 underground)', confirmed: '75', estimated: '0', source: 'Dobrov catalogue' },
  portland: { name: 'Portland', status: 'verified', stationsLabel: '94 (1 underground)', confirmed: '1', estimated: '–', source: 'en.wikipedia (Robertson Tunnel)', note: 'MAX runs almost entirely on the surface. Washington Park, in the Robertson Tunnel, is its only underground station.' },
  almaty: { name: 'Almaty', status: 'sourced', stationsLabel: '11', confirmed: '11', estimated: '0', source: 'ru/en.wikipedia, Dobrov', note: 'The 78 m figure for Abay still needs checking.' },
  moscow: { name: 'Moscow', status: 'verified', stationsLabel: '278 (256 underground)', confirmed: '273', estimated: '5', source: 'Dobrov catalogue', note: 'English Wikipedia names Park Pobedy as the deepest, at 84 m. The conflict is left open.' },
  london: { name: 'London', status: 'verified', stationsLabel: '~270 stations, 641 platforms', confirmed: 'all', estimated: '0', source: 'TfL FOI (official)', note: 'Underground only: no Elizabeth line, DLR or Overground.' },
  dnipro: { name: 'Dnipro', status: 'sourced', stationsLabel: '6 (5 with depth)', confirmed: '5', estimated: '0', source: 'Dobrov catalogue' },
  prague: { name: 'Prague', status: 'verified', stationsLabel: '61', confirmed: '61', estimated: '0', source: 'cs.wikipedia + DPP' },
  yekaterinburg: { name: 'Yekaterinburg', status: 'sourced', stationsLabel: '9', confirmed: '9', estimated: '0', source: 'Dobrov catalogue' },
  budapest: { name: 'Budapest', status: 'verified', stationsLabel: '52 platforms', confirmed: '42', estimated: '10', source: 'metros.hu + en.wikipedia', note: 'The 10 estimated depths are all on M1, about 3 m below the street.' },
  montreal: { name: 'Montreal', status: 'verified', stationsLabel: '73', confirmed: '72', estimated: '1', source: 'en/fr.wikipedia' },
  minsk: { name: 'Minsk', status: 'sourced', stationsLabel: '36', confirmed: '35', estimated: '1', source: 'Dobrov catalogue' },
  samara: { name: 'Samara', status: 'sourced', stationsLabel: '10 (9 underground)', confirmed: '10', estimated: '0', source: 'Dobrov catalogue' },
  novosibirsk: { name: 'Novosibirsk', status: 'sourced', stationsLabel: '14 (12 underground)', confirmed: '13', estimated: '1', source: 'Dobrov catalogue' },
};

const cities = {};

// --- Prague, Budapest: {lines:{K:{legend,color,geometry:[[[lon,lat]]]}}, platforms:[{station,line,depth,approx?,lat,lon,source}]}
function fromPlatforms(id, file, system) {
  const d = read(file);
  const lines = Object.entries(d.lines).map(([k, l]) => ({ id: k, name: l.legend, color: l.color, coords: l.geometry.map((seg) => seg.map(xy)) }));
  const legend = Object.fromEntries(Object.entries(d.lines).map(([k, l]) => [k, l.legend]));
  const stations = d.platforms.map((p) => ({ name: p.station, line: k2(legend, p.line), depth: r1(p.depth), est: !!p.approx, lon: r5(p.lon), lat: r5(p.lat), src: p.source?.split(' ')[0] }));
  cities[id] = { system, attribution: d.attribution, lines: lines.map((l) => ({ ...l, id: l.name })), stations };
}
const k2 = (legend, k) => legend[k] ?? k;

// --- London, Moscow, Montreal, Almaty, Portland: {lines:{name:{color, paths|path|ways}}, stations:[{name,line,lon,lat,depth,est?,check?}]}
function fromStations(id, file, system, lineName = (k, l) => l.legend || k) {
  const d = read(file);
  const lines = Object.entries(d.lines).map(([k, l]) => {
    const parts = l.paths || l.ways || [l.path];
    return { id: k, name: lineName(k, l), color: l.color, coords: parts.map((p) => p.map(xy)) };
  });
  const names = Object.fromEntries(lines.map((l) => [l.id, l.name]));
  const stations = d.stations.map((s) => ({ name: s.name, line: names[s.line] ?? s.line, depth: r1(s.depth), est: !!(s.est || s.check), lon: r5(s.lon), lat: r5(s.lat) }));
  cities[id] = { system, attribution: d.attribution, lines: lines.map((l) => ({ ...l, id: l.name })), stations, tunnel: d.tunnel ? { name: d.tunnel.name, length: d.tunnel.length } : undefined };
}

// --- Dobrov catalogue: lines[{color, n:{en}, st:[[names, -depth, lat, lon, type, estFlag]], paths:[[stIndex...]]}]
function fromDobrov(id, qid, system) {
  const d = read(`dobrov-catalog/raw/${qid}.json`);
  const lines = [], stations = [];
  for (const l of d.lines) {
    const name = (l.n.en || l.n.ru).replace(/ Line$/i, ' line');
    const paths = l.paths?.length ? l.paths : [chain(l.st)];
    lines.push({ id: name, name, color: l.color, coords: paths.map((p) => p.map((i) => [r5(l.st[i][3]), r5(l.st[i][2])])) });
    for (const s of l.st) {
      if (s[1] == null) continue;
      stations.push({ name: s[0][1] || s[0][0], native: s[0][0], line: name, depth: r1(-s[1]), est: !!s[5], lon: r5(s[3]), lat: r5(s[2]) });
    }
  }
  cities[id] = { system, attribution: 'Stations, lines and depths: direct.dobrovkonstantin.ru/metro (compiled from Wikidata and Wikipedia)', lines, stations, schematic: true };
}

// Some catalogue lines carry no station order: chain them nearest-neighbour from the station farthest from the centre.
function chain(st) {
  const pts = st.map((s) => [s[3], s[2]]);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  let cur = pts.reduce((bi, p, i) => (d2(p, [cx, cy]) > d2(pts[bi], [cx, cy]) ? i : bi), 0);
  const left = new Set(pts.map((_, i) => i)); const order = [];
  while (left.size) { left.delete(cur); order.push(cur); let nx = -1; for (const i of left) if (nx < 0 || d2(pts[i], pts[cur]) < d2(pts[nx], pts[cur])) nx = i; if (nx < 0) break; cur = nx; }
  return order;
}

fromPlatforms('prague', 'data/prague-depth.json', 'Prague Metro');
fromPlatforms('budapest', 'data/budapest-depth.json', 'Budapest Metro');
fromStations('london', 'london/data/london-depth.json', 'London Underground', (k) => k.replace(/ line$/, ''));
fromStations('moscow', 'moscow/data/moscow-depth.json', 'Moscow Metro', (k) => k.replace(/ line$/i, ''));
fromStations('montreal', 'montreal/data/montreal-depth.json', 'Montreal Metro', (k) => k);
fromStations('almaty', 'almaty/data/almaty-depth.json', 'Almaty Metro');
fromStations('portland', 'max/data/max-depth.json', 'MAX Light Rail', (k) => k);
fromDobrov('kyiv', 'Q215871', 'Kyiv Metro');
fromDobrov('st-petersburg', 'Q250225', 'Saint Petersburg Metro');
fromDobrov('minsk', 'Q232164', 'Minsk Metro');
fromDobrov('novosibirsk', 'Q272558', 'Novosibirsk Metro');
fromDobrov('samara', 'Q2106', 'Samara Metro');
fromDobrov('yekaterinburg', 'Q750441', 'Yekaterinburg Metro');
fromDobrov('dnipro', 'Q219374', 'Dnipro Metro');

// ---------- opening dates ----------
// Prague, Budapest, Almaty: per-line dates checked against operator chronologies (metro_anim-revert timeline datasets).
// The rest: Wikidata (scripts/fetch-metro-dates.mjs), matched by distance and name. Wikidata mostly gives one date per
// station, the day it first opened on any line, so an interchange platform can show an earlier date than its own line.
const ANIM = process.argv[3] || 'D:/projects/web/metro_anim-revert';
const WD = JSON.parse(readFileSync('scripts/data/metro-opening-dates.json', 'utf8'));
const WIKIDATA = WD.networks, WIKIDATA_LINES = WD.lines;
const fold = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\(.*?\)/g, ' ').replace(/\b(station|underground|tube|metro|line|stn)\b/g, ' ').replace(/[^a-z0-9а-яёіїєў]+/g, ' ').trim();
const distM = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180), (a.lat - b.lat) * 110540);
const sameName = (a, b) => { const x = fold(a), y = fold(b); return x.length > 2 && y.length > 2 && (x === y || x.includes(y) || y.includes(x)); };

function attachDates(id, c) {
  if (['prague', 'budapest', 'almaty'].includes(id)) {
    const d = JSON.parse(readFileSync(`${ANIM}/${id}-stations.json`, 'utf8'));
    const animLines = Object.keys(d.lines);
    for (const st of c.stations) {
      const near = d.stations.map((a) => ({ a, m: distM(st, a) })).filter((x) => x.m < 700);
      const pick = near.filter((x) => sameName(x.a.name, st.name)).sort((x, y) => x.m - y.m)[0] || near.filter((x) => x.m < 150).sort((x, y) => x.m - y.m)[0];
      if (!pick) continue;
      const line = animLines.length === 1 ? animLines[0] : st.line;
      st.opened = pick.a.lineDates?.[line] || pick.a.date; st.dateSrc = 'checked';
    }
    c.datesAttribution = 'Opening dates: operator chronologies and Wikipedia, checked per line';
  } else {
    const wd = (WIKIDATA[id] || []).filter((w) => w.open);
    for (const st of c.stations) {
      const near = wd.map((w) => ({ w, m: distM(st, w) })).filter((x) => x.m < 900);
      const pick = near.filter((x) => [x.w.name, ...x.w.names].some((n) => sameName(n, st.name) || (st.native && sameName(n, st.native)))).sort((a, b) => a.m - b.m)[0]
        || near.filter((x) => x.m < 200).sort((a, b) => a.m - b.m)[0];
      if (!pick) continue;
      const lineKey = Object.keys(pick.w.lines).find((l) => pick.w.lines[l] && sameName(l, st.line));
      st.opened = (lineKey && pick.w.lines[lineKey]) || pick.w.open; st.dateSrc = lineKey ? 'wikidata-line' : 'wikidata';
    }
    // Interchanges: a station-level date is the day the station first opened on any line (Westminster 1868), not the
    // day this platform's line arrived (Jubilee, 1999). A line cannot reach an interchange before its nearest station
    // that serves only that line, so such a platform takes the later of the two dates.
    const lineCount = (st) => new Set(c.stations.filter((o) => o.name === st.name && distM(st, o) < 400).map((o) => o.line)).size;
    const single = c.stations.filter((o) => o.opened && lineCount(o) === 1);
    let fixed = 0;
    for (const st of c.stations) {
      if (st.dateSrc !== 'wikidata' || lineCount(st) < 2) continue;
      const nb = single.filter((o) => o.line === st.line).map((o) => ({ o, m: distM(st, o) })).filter((x) => x.m < 4500).sort((a, b) => a.m - b.m)[0];
      if (nb && nb.o.opened > st.opened) { st.opened = nb.o.opened; st.dateSrc = 'wikidata-interchange'; fixed++; }
    }
    if (fixed) console.log('  dates', id.padEnd(14), `${fixed} interchange platforms moved to their line's arrival`);
    // no platform opens before its own line did
    const lineOpen = WIKIDATA_LINES[id] || {};
    let clamped = 0;
    for (const st of c.stations) {
      const key = Object.keys(lineOpen).find((l) => /line|линия|лінія|ligne/i.test(l) && sameName(l, st.line));
      if (key && st.opened && st.opened < lineOpen[key]) { st.opened = lineOpen[key]; clamped++; }
    }
    if (clamped) console.log('  dates', id.padEnd(14), `${clamped} platforms moved up to their line's opening`);
    c.datesAttribution = 'Opening dates: Wikidata (CC0)';
  }
  // a platform still without a date takes the date of the nearest dated platform on its line, marked as estimated
  const dated = c.stations.filter((x) => x.opened);
  for (const st of c.stations) if (!st.opened) {
    const near = dated.filter((o) => o.line === st.line).map((o) => ({ o, m: distM(st, o) })).sort((a, b) => a.m - b.m)[0];
    if (near) { st.opened = near.o.opened; st.dateSrc = 'nearest'; }
  }
  const n = c.stations.length, k = (src) => c.stations.filter((x) => x.dateSrc?.startsWith(src)).length;
  console.log('  dates', id.padEnd(14), `${k('checked') + k('wikidata')}/${n} matched, ${k('nearest')} from a neighbour, ${n - dated.length - k('nearest')} missing`);
}
for (const [id, c] of Object.entries(cities)) attachDates(id, c);

const index = [];
for (const [id, c] of Object.entries(cities)) {
  const m = META[id];
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const st of c.stations) { w = Math.min(w, st.lon); e = Math.max(e, st.lon); s = Math.min(s, st.lat); n = Math.max(n, st.lat); }
  const deepest = c.stations.reduce((a, b) => (b.depth > a.depth ? b : a));
  const below = c.stations.filter((x) => x.depth > 0).length;
  const out = { id, ...m, system: c.system, attribution: c.attribution, datesAttribution: c.datesAttribution, firstOpened: c.stations.map((x) => x.opened).filter(Boolean).sort()[0], schematic: !!c.schematic, bbox: [w, s, e, n], deepest: { name: deepest.name, depth: deepest.depth, line: deepest.line, lon: deepest.lon, lat: deepest.lat }, platformCount: c.stations.length, below, lines: c.lines, stations: c.stations, tunnel: c.tunnel };
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(out));
  const { lines, stations, ...head } = out;
  index.push({ ...head, center: [r5((w + e) / 2), r5((s + n) / 2)], lineCount: lines.length });
  console.log(id.padEnd(14), String(c.stations.length).padStart(4), 'platforms', String(c.lines.length).padStart(3), 'lines  deepest', deepest.name, deepest.depth);
}
index.sort((a, b) => b.deepest.depth - a.deepest.depth);
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
console.log('wrote', index.length, 'cities to', OUT);
