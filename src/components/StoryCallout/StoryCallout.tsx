import Button from '../Button/Button';
import type { Story } from '../../types';
import { formatStoryByline, formatStoryDate } from '../../utils/story';

export interface StoryCalloutProps {
  story: Story;
}

/**
 * The link from a work to the published piece it is about.
 *
 * It stands in for "View live" on any work that has a story: for those, that
 * button pointed at exactly this address. A reader deciding whether to open a
 * scroll narrative wants the standfirst and the byline, not a verb.
 */
export default function StoryCallout({ story }: StoryCalloutProps) {
  return (
    <aside className="story-callout">
      <p className="t-meta">
        Published {story.format}, {formatStoryDate(story.date)}
      </p>
      <h2 className="t-h3">{story.title}</h2>
      <p className="story-callout__dek">{story.dek}</p>
      <p className="t-meta">By {formatStoryByline(story.byline)}</p>
      {story.external ? (
        <Button variant="quiet" href={story.url} external icon="arrow-up-right">
          Read the story
        </Button>
      ) : (
        <Button variant="quiet" to={story.url} icon="arrow-right">
          Read the story
        </Button>
      )}
    </aside>
  );
}
