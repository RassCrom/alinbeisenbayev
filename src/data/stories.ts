import storiesData from './stories.json';
import { projects } from './projects';
import type { StoriesData, Story, StoryFormat } from '../types';

/**
 * The published pieces, newest first — reportages, reports and map essays.
 *
 * A story is the artifact a reader comes to for its subject; the /works entry
 * of the same name is the case study about making it. Both exist for most of
 * these, which is why `workSlug` is the link rather than a shared identity:
 * a story can outlive its case study, and a case study can cover work that
 * never became a story.
 *
 * Every `url` here points off-domain today. That is the thing this section is
 * meant to fix — see `external` in src/types.
 */
export const stories: Story[] = [...(storiesData as StoriesData).stories].sort((a, b) =>
  b.date.localeCompare(a.date),
);

/** The case study for a story, if one has been written. */
export function storyForWork(workSlug: string): Story | undefined {
  return stories.find((story) => story.workSlug === workSlug);
}

export const STORY_FORMATS: StoryFormat[] = ['scrollytelling', 'report', 'map essay'];

/*
 * Same dev-only check as projects.ts, and for the same reason: the JSON is read
 * through a cast, so a typo in `format` would render as an empty filter chip
 * rather than fail. A `workSlug` pointing at no project is the other silent
 * failure worth catching — it renders the work page's story callout on nothing.
 */
if (import.meta.env.DEV) {
  const problems = stories.flatMap((story) => {
    const found: string[] = [];
    if (!STORY_FORMATS.includes(story.format)) {
      found.push(`${story.slug}: format = ${JSON.stringify(story.format)}`);
    }
    if (story.workSlug && !projects.some((p) => p.slug === story.workSlug)) {
      found.push(`${story.slug}: workSlug = ${JSON.stringify(story.workSlug)} matches no project`);
    }
    return found;
  });
  if (problems.length > 0) {
    console.error(
      `[stories] ${problems.length} problem(s) in src/data/stories.json:\n  ${problems.join('\n  ')}`,
    );
  }
}
