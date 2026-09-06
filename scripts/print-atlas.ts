/*
 * Prints the atlas layout that buildAtlas derives from src/data/projects, so
 * the placement can be read and diffed without a browser. Runs under node's
 * native type stripping (node 22.18+ / 24), no bundler, no dependency:
 *
 *   npm run atlas:print                      table on stdout
 *   npm run atlas:print -- --as-of 2026-09   pin the month open-ended dates run to
 *   npm run atlas:print -- --svg out.svg     also write a schematic preview
 *   npm run atlas:print -- --json out.json   also write the raw Atlas
 *
 * Exits 1 when the atlas reports problems: a category with no island, a
 * series naming an unknown slug, or settlements that could not avoid overlap.
 *
 * This file lives outside tsconfig's `include`, so tsc never sees the node
 * imports; keep it small and let src/atlas/ carry the typed logic.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAtlas, paintingHalfWidth, TIER_LABEL, type Atlas } from '../src/atlas/index.ts';
import type { Project, ProjectsData } from '../src/types/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

/* Same merge as src/data/projects.ts: one JSON per city, filename order. */
const dir = join(root, 'src', 'data', 'projects');
const projects: Project[] = readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .flatMap((file) => (JSON.parse(readFileSync(join(dir, file), 'utf8')) as ProjectsData).projects);

const atlas = buildAtlas(projects, { asOf: flag('--as-of') ?? '2026-09' });

const pad = (value: string | number, width: number): string => String(value).padEnd(width);
const num = (value: number): string => value.toFixed(3);

console.log(`atlas: seed ${atlas.seed}, as of ${atlas.asOf}, ${projects.length} projects`);
console.log(
  `bounds: x ${num(atlas.bounds.minX)}..${num(atlas.bounds.maxX)}  y ${num(atlas.bounds.minY)}..${num(atlas.bounds.maxY)}\n`,
);

console.log('islands');
for (const island of atlas.islands) {
  console.log(
    `  ${pad(island.name, 9)} ${pad(island.biome, 9)} ${pad(island.category, 17)} n=${pad(island.projectCount, 2)} ` +
      `r=${num(island.radius)} at ${num(island.x)}, ${num(island.y)}  seat: ${island.seat ?? '-'}`,
  );
}

console.log('\nsettlements');
const byIsland = new Map(atlas.islands.map((island) => [island.id, island]));
for (const settlement of [...atlas.settlements].sort((a, b) => b.score - a.score)) {
  const marks = [settlement.isCapital && 'capital', settlement.hasPennant && 'pennant', settlement.pinned && 'pinned']
    .filter(Boolean)
    .join(' ');
  console.log(
    `  ${pad(settlement.score.toFixed(1), 5)} ${pad(TIER_LABEL[settlement.tier], 12)} ${pad(settlement.slug, 26)} ` +
      `${pad(byIsland.get(settlement.islandId)?.name ?? '?', 9)} ${num(settlement.x)}, ${num(settlement.y)}  ${marks}`,
  );
}

const crossing = atlas.lanes.filter((lane) => lane.crossing).length;
console.log(`\nlanes: ${atlas.lanes.length} (${crossing} sea, ${atlas.lanes.length - crossing} road)`);
for (const lane of atlas.lanes) {
  console.log(`  ${pad(lane.from, 26)} ${pad(lane.to, 26)} ${lane.crossing ? 'sea ' : 'road'}  ${lane.reason}: ${lane.shared.join(', ')}`);
}

const json = flag('--json');
if (json) {
  writeFileSync(json, JSON.stringify(atlas, null, 2));
  console.log(`\nwrote ${json}`);
}

const svg = flag('--svg');
if (svg) {
  writeFileSync(svg, renderSvg(atlas));
  console.log(`\nwrote ${svg}`);
}

if (atlas.warnings.length > 0) {
  console.error(`\n${atlas.warnings.length} problem(s):\n  ${atlas.warnings.join('\n  ')}`);
  process.exit(1);
}

/* ---- Schematic preview ---------------------------------------------------
 * The island paintings from public/atlas (by absolute file URL, so open the
 * SVG locally) under plain markers; the painted settlements are the
 * renderer's job. Enough to eyeball spacing, land placement, lanes and
 * label crowding.
 */
function renderSvg(atlas: Atlas): string {
  const W = 1600;
  const H = 1000;
  const PAD = 80;
  const b = atlas.bounds;
  const scale = Math.min((W - 2 * PAD) / (b.maxX - b.minX), (H - 2 * PAD) / (b.maxY - b.minY));
  const X = (x: number): number => PAD + (x - b.minX) * scale + (W - 2 * PAD - (b.maxX - b.minX) * scale) / 2;
  const Y = (y: number): number => PAD + (y - b.minY) * scale + (H - 2 * PAD - (b.maxY - b.minY) * scale) / 2;
  const biome: Record<string, string> = {
    meadow: '#4f7a3a', mountain: '#7c8290', conifer: '#2f5a3a', cliffs: '#5f6e63',
    dune: '#c9b27a', volcanic: '#4a3232', wetland: '#3f6b5a',
  };
  const size: Record<string, number> = { fortress: 13, 'walled-town': 11, 'market-town': 9, hamlet: 7, ruin: 7 };
  const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const bySlug = new Map(atlas.settlements.map((s) => [s.slug, s]));
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Georgia, 'Times New Roman', serif">`,
    `<rect width="${W}" height="${H}" fill="#0b1a2e"/>`,
  );
  const paintings = pathToFileURL(join(root, 'public', 'atlas')).href;
  for (const i of atlas.islands) {
    const r = i.radius * scale;
    const half = paintingHalfWidth(i) * scale;
    parts.push(
      `<circle cx="${X(i.x)}" cy="${Y(i.y)}" r="${r}" fill="${biome[i.biome]}" fill-opacity="0.12" stroke="rgba(220,235,255,0.35)" stroke-width="1.5" stroke-dasharray="3 5"/>`,
      `<image href="${paintings}/island-${i.id}.webp" x="${X(i.x) - half}" y="${Y(i.y) - half}" width="${2 * half}" height="${2 * half}"/>`,
    );
  }
  for (const l of atlas.lanes) {
    const a = bySlug.get(l.from);
    const c = bySlug.get(l.to);
    if (!a || !c) continue;
    parts.push(
      l.crossing
        ? `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="rgba(230,190,90,0.55)" stroke-width="1.6" stroke-dasharray="7 6"/>`
        : `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="rgba(120,90,50,0.9)" stroke-width="2"/>`,
    );
  }
  for (const s of atlas.settlements) {
    const x = X(s.x);
    const y = Y(s.y);
    const z = size[s.tier];
    const ruin = s.tier === 'ruin';
    const fill = ruin ? 'none' : '#f0d9a6';
    const stroke = ruin ? 'rgba(200,200,200,0.7)' : '#3a2a10';
    parts.push(
      s.tier === 'fortress' || s.tier === 'walled-town'
        ? `<rect x="${x - z}" y="${y - z}" width="${2 * z}" height="${2 * z}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
        : `<circle cx="${x}" cy="${y}" r="${z}" fill="${fill}" stroke="${stroke}" stroke-width="2"${ruin ? ' stroke-dasharray="3 3"' : ''}/>`,
    );
    if (s.hasPennant) parts.push(`<polygon points="${x + z + 2},${y - z - 8} ${x + z + 14},${y - z - 4} ${x + z + 2},${y - z}" fill="#c0392b"/>`);
    if (s.isCapital) parts.push(`<text x="${x}" y="${y - z - 10}" text-anchor="middle" font-size="20" fill="#e6c15a">♛</text>`);
    const title = s.title.length > 26 ? `${s.title.slice(0, 24)}…` : s.title;
    parts.push(
      `<text x="${x}" y="${y + z + 12}" text-anchor="middle" font-size="${ruin ? 9 : 10}" letter-spacing="1" fill="${ruin ? '#aab' : '#f3e9d2'}" stroke="rgba(0,0,0,0.75)" stroke-width="3" paint-order="stroke">${esc(title.toUpperCase())}</text>`,
    );
  }
  for (const i of atlas.islands) {
    parts.push(
      `<text x="${X(i.x)}" y="${Y(i.y) - i.radius * scale - 14}" text-anchor="middle" font-size="24" letter-spacing="7" fill="#efe3c6" stroke="rgba(0,0,0,0.8)" stroke-width="4" paint-order="stroke">${esc(i.name.toUpperCase())}</text>`,
      `<text x="${X(i.x)}" y="${Y(i.y) + i.radius * scale + 22}" text-anchor="middle" font-size="12" letter-spacing="2" fill="rgba(240,230,210,0.7)">${esc(`${i.category} · ${i.biome} · ${i.projectCount}`.toUpperCase())}</text>`,
    );
  }
  parts.push(
    `<text x="24" y="36" font-size="20" letter-spacing="3" fill="#efe3c6">ATLAS LAYOUT · SCHEMATIC · SEED ${atlas.seed} · AS OF ${atlas.asOf}</text>`,
    `<text x="24" y="60" font-size="13" fill="rgba(240,230,210,0.7)">Squares: fortress, walled town. Circles: market town, hamlet. Dashed hollow: ruin. Gold dashes: sea lanes. Brown: roads. Flag: awards. Crown: capital. Dotted ring: buildable zone.</text>`,
    '</svg>',
  );
  return parts.join('\n');
}
