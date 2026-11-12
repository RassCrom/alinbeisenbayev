/*
 * Weight budget for the home page, checked on the built site.
 *
 *     pnpm build && pnpm budget
 *
 * Counts what a first visit to `/` has to download before it can be used:
 * the entry script, everything index.html preloads, the home page's own
 * chunk with every chunk it statically imports, and the entry stylesheet,
 * all gzipped. Fails when either total is
 * over budget, so weight is caught when it is added, not at the end.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const HOME_JS_GZIP = 90 * 1024;
const HOME_CSS_GZIP = 20 * 1024;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const gzip = (file) => gzipSync(readFileSync(join(DIST, file))).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const scripts = new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]));
const homeChunk = readdirSync(join(DIST, 'assets')).find((file) => /^HomePage-.*\.js$/.test(file));
if (homeChunk) scripts.add(`assets/${homeChunk}`);

// A chunk's static imports arrive with it. Dynamic import() does not count:
// that code loads only when something asks for it.
const STATIC_IMPORT = /(?:from|import)\s*"\.\/([^"]+\.js)"/g;
for (const file of scripts) {
  const source = readFileSync(join(DIST, file), 'utf8');
  for (const match of source.matchAll(STATIC_IMPORT)) scripts.add(`assets/${match[1]}`);
}
const styles = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((m) => m[1]);

let js = 0;
for (const file of scripts) {
  const size = gzip(file);
  js += size;
  console.log(`  script  ${kb(size).padStart(9)}  ${file}`);
}
let css = 0;
for (const file of styles) {
  const size = gzip(file);
  css += size;
  console.log(`  style   ${kb(size).padStart(9)}  ${file}`);
}

const jsOk = js <= HOME_JS_GZIP;
const cssOk = css <= HOME_CSS_GZIP;
console.log(`\nhome script  ${kb(js)} of ${kb(HOME_JS_GZIP)}  ${jsOk ? 'ok' : 'OVER BUDGET'}`);
console.log(`home styles  ${kb(css)} of ${kb(HOME_CSS_GZIP)}  ${cssOk ? 'ok' : 'OVER BUDGET'}`);
process.exit(jsOk && cssOk ? 0 : 1);
