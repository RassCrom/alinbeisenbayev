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
  { path: '/works', title: 'Work', description: 'Custom maps, spatial analysis, data visualization, data journalism and remote sensing work by Alikhan Beisenbayev.', priority: '0.9' },
  { path: '/journal', title: 'Journal', description: 'Map stories, notes on how they were made, and tools, by Alikhan Beisenbayev.', priority: '0.8' },
  { path: '/about', title: 'About', description: 'Alikhan Beisenbayev, cartographer and data storyteller: recognition, audience, and the route from Astana to Vienna.', priority: '0.8' },
  { path: '/journal/map-awards', title: 'Map Awards Calendar', description: 'Every cartography, GIS and data visualization award on one map: deadlines, prizes, what to submit, and a calendar feed for Google, Apple and Outlook.', image: '/images/blog/map-awards/cover.jpg', imageAlt: 'Map Awards Calendar', priority: '0.7' },
  { path: '/contact', title: 'Work with me', description: 'Commission a custom map, a spatial analysis, a data visualization, a data story or remote sensing work.', priority: '0.8' },
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
        // Hidden projects keep their page (old links still open) but drop
        // out of the sitemap, like they drop out of every listing.
        inSitemap: !project.hidden,
      });
    }
  }

  for (const story of readJson('src/data/stories.json').stories) {
    list.push({
      path: `/journal/${story.slug}`,
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
      path: `/journal/${file.replace(/\.mdx$/, '')}`,
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
/*
 * Loading hints.
 *
 * Every page is a lazy route: the browser fetches the entry script, runs it,
 * and only then learns which page chunk it needs, and only after that which
 * image. On a slow phone that chain put the home page's main image on screen
 * at 4.8 s. Each route's HTML is written here, where the route is known, so
 * it can name its page chunk (and what that imports) up front; the home page
 * also names the image it leads with.
 */
const ASSETS = readdirSync(join(DIST, 'assets'));
const STATIC_IMPORT = /(?:from|import)\s*"\.\/([^"]+\.js)"/g;

/** The lazy page a path renders. Kept in step with the routes in src/App.tsx. */
function pageFor(path) {
  if (path === '/') return 'HomePage';
  if (path === '/works') return 'WorksPage';
  if (path.startsWith('/works/')) return 'WorkDetailPage';
  if (path === '/journal') return 'JournalPage';
  if (path === '/journal/map-awards') return 'MapAwardsPage';
  if (path.startsWith('/journal/')) return 'JournalEntryPage';
  if (path === '/about') return 'AboutPage';
  if (path === '/contact') return 'ContactPage';
  return null;
}

/** A page's chunk and every chunk it statically imports, minus what index.html already loads. */
function chunksFor(page, template) {
  const start = ASSETS.find((file) => file.startsWith(`${page}-`) && file.endsWith('.js'));
  if (!start) return [];
  const found = new Set([start]);
  for (const file of found) {
    for (const match of readFileSync(join(DIST, 'assets', file), 'utf8').matchAll(STATIC_IMPORT)) found.add(match[1]);
  }
  return [...found].filter((file) => !template.includes(`/assets/${file}`));
}

/** Same candidates, in the same order, as coverSrcSet() in src/utils/images.ts, or the browser fetches twice. */
function coverSrcSet(url) {
  const entry = variants[url];
  if (!entry || entry.variants.length === 0) return null;
  const base = url.replace(/\.[^./]+$/, '');
  return [...entry.variants.map((width) => `${base}-w${width}.webp ${width}w`), `${url} ${entry.width}w`].join(', ');
}

/** The cover the home page's hero stack puts in front: the first featured work's. */
function heroCover() {
  const featured = readdirSync(join(ROOT, 'src/data/projects'))
    .flatMap((file) => readJson(`src/data/projects/${file}`).projects)
    .filter((project) => project.featured && !project.hidden)
    .sort((a, b) => (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity));
  return featured[0]?.coverImage ?? null;
}

/**
 * The cover of the journal's newest entry, which leads the index.
 *
 * Mirrors the ordering in src/data/journal.ts (newest first, title breaking
 * a tie) over the same three sources. If the two ever disagree the cost is a
 * wasted preload, not a wrong page.
 */
function journalLeadCover() {
  const when = (date) => {
    const [year, month = '12', day = '0'] = date.split('-');
    return Number(year) * 12 + Number(month) + Number(day) / 32;
  };
  const entries = readJson('src/data/stories.json').stories.map((story) => ({
    title: story.title,
    when: when(story.date),
    cover: story.coverImage,
  }));
  for (const file of readdirSync(join(ROOT, 'src/content/blog'))) {
    if (!file.endsWith('.mdx')) continue;
    const data = frontmatter(readFileSync(join(ROOT, 'src/content/blog', file), 'utf8'));
    if (data.draft === 'true' || data.hidden === 'true') continue;
    entries.push({ title: data.title, when: when(data.date), cover: data.cover ?? '/images/placeholder.jpg' });
  }
  entries.push({ title: 'Map Awards Calendar', when: when('2026-11'), cover: '/images/blog/map-awards/cover.jpg' });
  entries.sort((a, b) => b.when - a.when || a.title.localeCompare(b.title));
  return entries[0]?.cover ?? null;
}

/**
 * The image each of these pages leads with, and the `sizes` its <img> uses.
 * Kept in step with HeroStack.tsx (front sheet) and COVER_SIZES.cardWide in
 * src/utils/images.ts (the journal's lead card).
 */
const LEAD_IMAGE = {
  '/': () => ({ cover: heroCover(), sizes: '(min-width: 768px) 46vw, 92vw' }),
  '/journal': () => ({ cover: journalLeadCover(), sizes: '(min-width: 1152px) 1104px, 100vw' }),
};

function withHints(html, path, template) {
  const page = pageFor(path);
  const links = page ? chunksFor(page, template).map((file) => `<link rel="modulepreload" href="/assets/${file}" />`) : [];
  const lead = LEAD_IMAGE[path]?.();
  if (lead?.cover) {
    const srcset = coverSrcSet(lead.cover);
    links.push(
      `<link rel="preload" as="image" href="${lead.cover}"${srcset ? ` imagesrcset="${srcset}" imagesizes="${lead.sizes}"` : ''} fetchpriority="high" />`,
    );
  }
  return links.length ? html.replace('</head>', `    ${links.join('\n    ')}\n  </head>`) : html;
}

/**
 * The text face, asked for in the HTML itself. Without this the browser only
 * learns it needs the font once the stylesheet has loaded and text has been
 * laid out, so a fast page paints in the fallback face first and then jumps
 * when the real one arrives (0.10 layout shift on /contact).
 */
function withFont(html) {
  const font = ASSETS.find((file) => /^geologica-latin-wght-normal-.*\.woff2$/.test(file));
  if (!font) return html;
  const link = `<link rel="preload" as="font" type="font/woff2" href="/assets/${font}" crossorigin />`;
  return html.replace('</head>', `    ${link}\n  </head>`);
}

const template = withFont(readFileSync(join(DIST, 'index.html'), 'utf8'));
const all = routes();
for (const route of all) {
  const file = join(DIST, `${route.path}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, withHints(render(template, route), route.path, template));
}
// Last, so no other page inherits the home page's hints from the template.
writeFileSync(join(DIST, 'index.html'), withHints(template, '/', template));

const listed = all.filter((r) => r.inSitemap !== false);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <url><loc>${SITE_ORIGIN}/</loc><priority>1.0</priority></url>`,
  ...listed.map((r) => `  <url><loc>${SITE_ORIGIN}${r.path}</loc><priority>${r.priority}</priority></url>`),
  '</urlset>',
  '',
].join('\n');
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);

console.log(`prerendered ${all.length} route heads and sitemap.xml (${listed.length + 1} URLs)`);
