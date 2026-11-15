// Fetches station opening dates for the metro depth map from Wikidata and writes scripts/data/metro-opening-dates.json.
// node scripts/fetch-metro-dates.mjs
// Prague, Budapest and Almaty are not fetched here: their per-line dates come from the checked
// datasets in metro_anim-revert (see build-metro-depth.mjs).
import { writeFileSync, mkdirSync } from 'node:fs';

const NETWORKS = {
  london: 'Q20075', moscow: 'Q5499', 'st-petersburg': 'Q250225', kyiv: 'Q215871', minsk: 'Q232164',
  novosibirsk: 'Q272558', samara: 'Q2106', yekaterinburg: 'Q750441', dnipro: 'Q219374',
  montreal: 'Q392377', portland: 'Q2584009',
};
const query = `SELECT ?net ?st ?stLabel ?alt ?coord ?open ?close ?lineLabel ?lstart WHERE {
  VALUES ?net { ${Object.values(NETWORKS).map((q) => 'wd:' + q).join(' ')} }
  ?st wdt:P16 ?net .
  OPTIONAL { ?st wdt:P625 ?coord }
  OPTIONAL { ?st wdt:P1619 ?open }
  OPTIONAL { ?st wdt:P3999 ?close }
  OPTIONAL { ?st rdfs:label ?alt FILTER(lang(?alt) IN ("ru","uk","be","fr")) }
  OPTIONAL { ?st p:P81 ?ls . ?ls ps:P81 ?line . OPTIONAL { ?ls pq:P580 ?lstart } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,uk,ru,fr" }
}`;
const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(query), {
  headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'metro-depth-map/0.1 (data build script)' },
});
if (!res.ok) throw new Error('Wikidata ' + res.status);
const rows = (await res.json()).results.bindings;
const byQ = Object.fromEntries(Object.entries(NETWORKS).map(([k, q]) => [q, k]));
const out = Object.fromEntries(Object.keys(NETWORKS).map((k) => [k, {}]));
const day = (v) => v?.value.slice(0, 10);
for (const b of rows) {
  const city = byQ[b.net.value.split('/').pop()], id = b.st.value.split('/').pop();
  const m = b.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  if (!m) continue;
  const s = (out[city][id] ||= { id, name: b.stLabel.value, names: [], lon: +(+m[1]).toFixed(5), lat: +(+m[2]).toFixed(5), lines: {} });
  if (b.alt && !s.names.includes(b.alt.value)) s.names.push(b.alt.value);
  // some stations carry two opening dates, e.g. Buckhurst Hill: 1856 as a railway station, 1948 on the Central line.
  // For a metro the later one is when the metro arrived, so keep them all and use the latest.
  if (b.open) { s.opens ||= []; if (!s.opens.includes(day(b.open))) s.opens.push(day(b.open)); s.open = s.opens.slice().sort().pop(); }
  if (b.close) s.close = day(b.close);
  if (b.lineLabel) { const l = b.lineLabel.value; if (b.lstart && (!s.lines[l] || day(b.lstart) < s.lines[l])) s.lines[l] = day(b.lstart); else s.lines[l] ||= null; }
}
// each line's own opening date: no platform can open before its line existed
const lineQuery = `SELECT ?net ?lineLabel ?open WHERE {
  VALUES ?net { ${Object.values(NETWORKS).map((q) => 'wd:' + q).join(' ')} }
  ?line wdt:P16 ?net ; wdt:P1619 ?open .
  FILTER NOT EXISTS { ?line wdt:P31 wd:Q928830 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,uk,ru,fr" }
}`;
const lres = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(lineQuery), {
  headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'metro-depth-map/0.1 (data build script)' },
});
if (!lres.ok) throw new Error('Wikidata lines ' + lres.status);
const lines = Object.fromEntries(Object.keys(NETWORKS).map((k) => [k, {}]));
for (const b of (await lres.json()).results.bindings) {
  const city = byQ[b.net.value.split('/').pop()], name = b.lineLabel.value, d = day(b.open);
  if (!lines[city][name] || d < lines[city][name]) lines[city][name] = d;
}
mkdirSync('scripts/data', { recursive: true });
const compact = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.values(v)]));
writeFileSync('scripts/data/metro-opening-dates.json', JSON.stringify({ source: 'Wikidata (CC0), P1619 date of official opening, P81 connecting line with P580 start time', fetched: new Date().toISOString().slice(0, 10), networks: compact, lines }));
for (const [k, v] of Object.entries(compact)) console.log(k.padEnd(14), v.length, 'stations,', v.filter((s) => s.open).length, 'dated,', Object.keys(lines[k]).length, 'lines dated');
