/*
 * Per-route HTML heads, written after `vite build`.
 *
 *     node scripts/prerender-routes.mjs
 *
 * The site is client-rendered, so a link unfurler (LinkedIn, Telegram, Slack,
 * X) or a crawler that does not run JS only ever sees dist/index.html — every
 * shared URL used to unfurl as the homepage. This copies that file to
 * dist/<route>.html for every known route with its own <title>,
 * description, canonical and og:/twitter: tags, and writes a sitemap listing
 * all of them. The body is untouched: React mounts into #root exactly as it
 * does from the root file, and any path not listed here still falls through
 * the host's SPA rewrite to dist/index.html.
 *
 * Titles and descriptions for the section pages mirror their usePageMeta()
 * calls; detail pages read the same data files the app does. og:image uses the
 * 1200x630 JPEG from scripts/prepare-images.py when there is one.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
/** Kept in sync with SITE_ORIGIN in src/hooks/usePageMeta.ts. */
const SITE_ORIGIN = 'https://alinbeisenbayev.com';
const SITE_NAME = 'Alikhan Beisenbayev';
const DEFAULT_IMAGE = '/og-cover.jpg';

const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const variants = readJson('src/data/image-variants.json');

/** og:image for a cover URL: the generated card, else the site card. */
function ogImage(cover) {
  if (!cover || cover.includes('placeholder')) return DEFAULT_IMAGE;
  return variants[cover]?.og ?? DEFAULT_IMAGE;
}

/** The fields of a flat YAML frontmatter block that this needs. */
function frontmatter(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const data = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;
    const raw = match[2].trim();
    data[match[1]] = raw.startsWith('"') ? raw.slice(1, -1) : raw;
  }
  return data;
}

const SECTIONS = [
  { path: '/works', title: 'Works', description: 'Selected cartography, geospatial and interactive map projects — filterable by keyword, and mapped by where each was made and what it maps.', priority: '0.9' },
  { path: '/gallery', title: 'Gallery', description: 'Finished maps, posters and map animations — the visuals on their own, without the case studies.', priority: '0.7' },
  { path: '/stories', title: 'Stories', description: 'Scroll-driven map narratives, reports and map essays on history, climate and Central Asia.', priority: '0.8' },
  { path: '/about', title: 'About', description: 'From Astana to Munich, Vienna and Dresden — the route through geodesy, GIS and cartography, told on a globe.', priority: '0.8' },
  { path: '/skills', title: 'Skills', description: 'Cartography, GIS, remote sensing, web mapping and data visualisation — each skill linked to the work that used it.', priority: '0.7' },
  { path: '/blog', title: 'Blog', description: 'Notes, tutorials and map breakdowns on cartography, QGIS and geospatial storytelling.', priority: '0.7' },
  { path: '/connect', title: 'Connect', description: 'Open to job offers and collaboration. LinkedIn, GitHub, Instagram, TikTok, Telegram, email and CV.', priority: '0.6' },
];

function routes() {
  const list = [...SECTIONS];

  for (const file of readdirSync(join(ROOT, 'src/data/projects'))) {
    for (const project of readJson(`src/data/projects/${file}`).projects) {
      list.push({
        path: `/works/${project.slug}`,
        title: project.title,
        description: project.tagline,
        image: ogImage(project.coverImage),
        imageAlt: project.title,
        type: 'article',
        priority: project.featured ? '0.8' : '0.6',
      });
    }
  }

  for (const story of readJson('src/data/stories.json').stories) {
    list.push({
      path: `/stories/${story.slug}`,
      title: story.title,
      description: story.dek,
      image: ogImage(story.coverImage),
      imageAlt: story.title,
      type: 'article',
      priority: '0.7',
    });
  }

  for (const file of readdirSync(join(ROOT, 'src/content/blog'))) {
    if (!file.endsWith('.mdx')) continue;
    const data = frontmatter(readFileSync(join(ROOT, 'src/content/blog', file), 'utf8'));
    // Same filter as src/content/blog.ts: drafts and hidden posts have no page.
    if (data.draft === 'true' || data.hidden === 'true') continue;
    list.push({
      path: `/blog/${file.replace(/\.mdx$/, '')}`,
      title: data.title,
      description: data.excerpt,
      image: ogImage(data.cover),
      imageAlt: data.title,
      type: 'article',
      priority: '0.6',
    });
  }
  return list;
}

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replace the content of a <meta name|property="key"> tag, however it is wrapped. */
function setMeta(html, key, value) {
  const pattern = new RegExp(`(<meta\\s+(?:name|property)="${key}"\\s+content=")[^"]*(")`);
  if (!pattern.test(html)) throw new Error(`index.html has no <meta> for ${key}`);
  return html.replace(pattern, `$1${escape(value)}$2`);
}

function render(template, route) {
  const url = `${SITE_ORIGIN}${route.path}`;
  const title = `${route.title} — ${SITE_NAME}`;
  const image = `${SITE_ORIGIN}${route.image ?? DEFAULT_IMAGE}`;
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  html = setMeta(html, 'description', route.description);
  html = setMeta(html, 'og:type', route.type ?? 'website');
  html = setMeta(html, 'og:url', url);
  html = setMeta(html, 'og:title', title);
  html = setMeta(html, 'og:description', route.description);
  html = setMeta(html, 'og:image', image);
  if (route.imageAlt) html = setMeta(html, 'og:image:alt', route.imageAlt);
  html = setMeta(html, 'twitter:title', title);
  html = setMeta(html, 'twitter:description', route.description);
  html = setMeta(html, 'twitter:image', image);
  return html;
}

/*
 * Flat files (works/gulag.html), not directories (works/gulag/index.html):
 * `/works/gulag` resolves to the .html file on Vercel with cleanUrls, on
 * Netlify by default and in `vite preview`, whereas a directory index is only
 * found there with a trailing slash — without one they fall back to the SPA
 * shell and the route's head is lost.
 */
const template = readFileSync(join(DIST, 'index.html'), 'utf8');
const all = routes();
for (const route of all) {
  const file = join(DIST, `${route.path}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(template, route));
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <url><loc>${SITE_ORIGIN}/</loc><priority>1.0</priority></url>`,
  ...all.map((r) => `  <url><loc>${SITE_ORIGIN}${r.path}</loc><priority>${r.priority}</priority></url>`),
  '</urlset>',
  '',
].join('\n');
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);

console.log(`prerendered ${all.length} route heads and sitemap.xml (${all.length + 1} URLs)`);
