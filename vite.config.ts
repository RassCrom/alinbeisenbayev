import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import rehypeSlug from 'rehype-slug';

export default defineConfig({
  plugins: [
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
