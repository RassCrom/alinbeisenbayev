import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import rehypeSlug from 'rehype-slug';
import type { Plugin } from 'vite';
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

export default defineConfig({
  plugins: [
    awardsCalendar(),
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
