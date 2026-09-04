/**
 * Regenerates public/sitemap.xml from the project JSON and the blog MDX files.
 *
 *   node scripts/generate-sitemap.mjs
 *
 * Run it after adding a project or a post. Kept as a script rather than a build
 * step so the generated file stays reviewable in git.
 */
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://alinbeisenbayev.com';
const PROJECTS_DIR = 'src/data/projects';
const BLOG_DIR = 'src/content/blog';

/** Static routes, with the priority each deserves relative to the homepage. */
const STATIC_ROUTES = [
  ['/', 1.0],
  ['/works', 0.9],
  ['/about', 0.8],
  ['/skills', 0.7],
  ['/blog', 0.7],
  ['/connect', 0.6],
];

const projects = fs
  .readdirSync(PROJECTS_DIR)
  .flatMap((file) => JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf8')).projects);

/** Reads just the frontmatter keys the sitemap needs — no MDX parsing required. */
function frontmatter(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return {};
  const out = {};
  for (const line of block[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const articles = fs
  .readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => ({
    slug: f.replace(/\.mdx$/, ''),
    ...frontmatter(fs.readFileSync(path.join(BLOG_DIR, f), 'utf8')),
  }))
  // Same exclusions the site applies in src/content/blog.ts
  .filter((a) => a.draft !== 'true' && a.hidden !== 'true');

/** `2026-07` and `Present` both appear in endDate; only a real date is useful. */
function lastmod(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

const urls = [
  ...STATIC_ROUTES.map(([loc, priority]) => ({ loc, priority })),
  ...projects.map((p) => ({
    loc: `/works/${p.slug}`,
    priority: p.featured ? 0.8 : 0.6,
    lastmod: lastmod(p.endDate) ?? lastmod(p.startDate),
  })),
  ...articles.map((a) => ({ loc: `/blog/${a.slug}`, priority: 0.6, lastmod: lastmod(a.date) })),
];

const body = urls
  .map(({ loc, priority, lastmod: mod }) =>
    [
      '  <url>',
      `    <loc>${ORIGIN}${loc}</loc>`,
      mod ? `    <lastmod>${mod}</lastmod>` : null,
      `    <priority>${priority.toFixed(1)}</priority>`,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

fs.writeFileSync('public/sitemap.xml', xml);
console.log(
  `public/sitemap.xml — ${urls.length} URLs ` +
    `(${STATIC_ROUTES.length} static, ${projects.length} works, ${articles.length} posts)`,
);
