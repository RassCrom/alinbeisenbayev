import type { Project, ProjectCategory, ProjectStatus, ProjectType, ProjectsData } from '../types';

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

/*
 * TypeScript can't police this data on its own: JSON string values widen to
 * `string`, so the file has to be read through a cast, and a cast is exactly
 * what let `category` drift to eleven values against a union of five, and
 * `status` carry both "complete" and "done" for one state.
 *
 * So the check happens here instead, in dev only — it costs nothing in the
 * production bundle and fails loudly in the terminal the moment a new project
 * introduces a value the UI doesn't know how to render.
 */
const VALID_TYPES: ProjectType[] = ['website', 'static-map', 'animation'];
const VALID_STATUSES: ProjectStatus[] = ['complete', 'in-progress'];
const VALID_CATEGORIES: ProjectCategory[] = [
  'social media',
  'print',
  'storytelling map',
  'interactive map',
  'game',
  'analysis',
  'platform',
];

if (import.meta.env.DEV) {
  const problems = projects.flatMap((project) => {
    const check = <T,>(field: string, value: T, allowed: readonly T[]) =>
      allowed.includes(value) ? [] : [`${project.slug}: ${field} = ${JSON.stringify(value)}`];
    return [
      ...check('type', project.type, VALID_TYPES),
      ...check('status', project.status, VALID_STATUSES),
      ...check('category', project.category, VALID_CATEGORIES),
    ];
  });
  if (problems.length > 0) {
    const detail = problems.join(`\n  `);
    console.error(
      `[projects] ${problems.length} value(s) outside the declared unions in src/types:\n  ${detail}`,
    );
  }
}
