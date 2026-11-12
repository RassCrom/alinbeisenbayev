import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import rehypeSlug from 'rehype-slug';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, type Plugin } from 'vite';
import { awardsData } from './src/data/mapAwards';
import { AWARDS_FEED_PATH, buildIcs } from './src/utils/ics';

/**
 * The subscribable calendar of map-award deadlines (/calendars/map-awards.ics),
 * built from the same JSON the /blog/map-awards page reads, so the feed can
 * never drift from the map. Served live in dev, emitted as a file on build.
 */
function awardsCalendar(): Plugin {
  const feed = () =>
    buildIcs(awardsData.awards, awardsData.checked, (a) => {
      const place = awardsData.places[a.place];
      return place ? `${place.name} (${place.detail})` : '';
    });
  return {
    name: 'awards-calendar',
    configureServer(server) {
      server.middlewares.use(AWARDS_FEED_PATH, (_req, res) => {
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.end(feed());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: AWARDS_FEED_PATH.slice(1), source: feed() });
    },
  };
}

/**
 * Serves POST /api/contact in dev through the same handler the Cloudflare
 * Pages Function uses in production (functions/api/contact.ts), with the
 * variables from .env.local. Without them the handler answers "not
 * configured" and the form shows its failed state, which is the honest
 * result locally.
 */
function contactEndpoint(): Plugin {
  return {
    name: 'contact-endpoint',
    configureServer(server) {
      // Every variable, not only VITE_ ones: these are server-side secrets.
      const env = loadEnv(server.config.mode, server.config.root, '');
      server.middlewares.use('/api/contact', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(name, value);
        }
        const { handleContact } = await server.ssrLoadModule('/src/server/contact.ts');
        const response: Response = await handleContact(
          new Request(`http://${req.headers.host}/api/contact`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          }),
          env,
        );
        res.statusCode = response.status;
        response.headers.forEach((value, name) => res.setHeader(name, value));
        res.end(await response.text());
      });
    },
  };
}

/**
 * `virtual:notes-meta`: the frontmatter of every post under src/content/blog,
 * read at build time, without the posts themselves.
 *
 * Importing a post for its frontmatter drags its whole body into the bundle
 * (an MDX module does not tree-shake), which put every post's text on the
 * home page to show three cards. This hands out the handful of fields a list
 * needs and nothing else.
 */
function notesMeta(): Plugin {
  const id = 'virtual:notes-meta';
  const resolved = '\0' + id;
  const dir = join(__dirname, 'src/content/blog');
  /** A frontmatter value: a quoted string, an array or a boolean reads as JSON; anything else stays text. */
  const parse = (raw: string): unknown => {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };
  return {
    name: 'notes-meta',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(loaded) {
      if (loaded !== resolved) return undefined;
      const notes = readdirSync(dir)
        .filter((file) => file.endsWith('.mdx'))
        .map((file) => {
          const path = join(dir, file);
          // A post edited in dev refreshes the list.
          this.addWatchFile(path);
          const block = readFileSync(path, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
          const frontmatter: Record<string, unknown> = {};
          for (const line of block.split(/\r?\n/)) {
            const match = line.match(/^(\w+):\s*(.*)$/);
            if (match) frontmatter[match[1]] = parse(match[2].trim());
          }
          return { slug: file.replace(/\.mdx$/, ''), frontmatter };
        });
      return `export default ${JSON.stringify(notes)};`;
    },
  };
}

export default defineConfig({
  test: { environment: 'jsdom', setupFiles: 'src/test/setup.ts' },
  plugins: [
    awardsCalendar(),
    notesMeta(),
    contactEndpoint(),
    // Must run before @vitejs/plugin-react so .mdx compiles to JSX first.
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
        rehypePlugins: [rehypeSlug],
      }),
    },
    react(),
    tailwindcss(),
  ],
  /*
   * No manualChunks.
   *
   * There used to be 'vendor-maplibre' and 'vendor-globe' entries here. Naming
   * a chunk that way pulls it into the initial graph, so Vite emitted a
   * <link rel="modulepreload"> for both in index.html — meaning every visitor
   * downloaded MapLibre and three.js on the homepage, whether or not they ever
   * opened the map or the About page. Letting Rollup split on the dynamic
   * import boundaries instead keeps MapLibre inside the lazy WorksMap chunk,
   * which is the only thing that needs it.
   */
});
