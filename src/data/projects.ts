import type { Project, ProjectsData } from '../types';

/**
 * Source of truth is one JSON file per city under ./projects/*.json — add a
 * project to its city's file, or drop in a new city file, and it shows up
 * here with no code changes. Files are merged in filename (alphabetical)
 * order, so a project's position in `projects` — and therefore in anything
 * that reads array order directly, like the landing page's featured slice —
 * depends on which city file it's in, not just when it was added.
 */
const cityModules = import.meta.glob<{ default: ProjectsData }>('./projects/*.json', {
  eager: true,
});

export const projects: Project[] = Object.keys(cityModules)
  .sort()
  .flatMap((path) => cityModules[path].default.projects);
