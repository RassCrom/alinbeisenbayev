/** Provided by the `notes-meta` plugin in vite.config.ts. */
declare module 'virtual:notes-meta' {
  const notes: { slug: string; frontmatter: Record<string, unknown> }[];
  export default notes;
}
