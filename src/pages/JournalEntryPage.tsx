import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../components/Button/Button';
import ChapterNav from '../components/ChapterNav/ChapterNav';
import Frame from '../components/Frame/Frame';
import JournalCard from '../components/JournalCard/JournalCard';
import WorkCard from '../components/WorkCard/WorkCard';
import { articles } from '../content/blog';
import { storyBodies } from '../content/stories';
import { journalEntries, type JournalEntry } from '../data/journal';
import { allProjects } from '../data/projects';
import { stories } from '../data/stories';
import { usePageMeta } from '../hooks/usePageMeta';
import { COVER_SIZES } from '../utils/images';
import { formatStoryByline } from '../utils/story';
import NotFoundPage from './NotFoundPage';

const AUTHOR = 'Alikhan Beisenbayev';

/** A note's reading time, measured from what was rendered. About 200 words a minute, never under one. */
function useReadingMinutes(slug: string | undefined, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    // textContent, not innerText: the count should not depend on layout.
    const words = (el.textContent?.match(/\S+/g) ?? []).length;
    setMinutes(Math.max(1, Math.round(words / 200)));
  }, [slug, enabled]);
  return { ref, minutes };
}

/**
 * One journal entry: a published story or a method note.
 *
 * A story written in the repo is the piece itself; one published elsewhere
 * gets its standfirst and credits here and a link on. A note is always the
 * piece itself. The Map Awards Calendar has its own page and route.
 */
export default function JournalEntryPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = journalEntries.find((item) => item.slug === slug && item.kind !== 'Tool');
  const story = entry?.kind === 'Story' ? stories.find((s) => s.slug === slug) : undefined;
  const note = entry?.kind === 'Note' ? articles.find((a) => a.slug === slug) : undefined;

  // Before the not-found branch: hooks can't sit behind a conditional return.
  usePageMeta(entry?.title, entry?.summary, { enabled: Boolean(entry) });
  const reading = useReadingMinutes(slug, Boolean(note));

  if (!entry || (!story && !note)) return <NotFoundPage />;

  // A story marked as written here whose body file is missing falls back to
  // the link out, rather than rendering an empty page.
  const StoryBody: ComponentType | undefined = story && !story.external ? storyBodies[story.slug] : undefined;
  if (import.meta.env.DEV && story && !story.external && !StoryBody) {
    console.error(`[journal] ${story.slug} is external: false but src/content/stories/${story.slug}.mdx is missing.`);
  }
  const Body = StoryBody ?? note?.Component;

  const meta = story
    ? `By ${formatStoryByline(story.byline)}, ${entry.date}`
    : `By ${AUTHOR}, ${entry.date}${reading.minutes !== null ? `, ${reading.minutes} min read` : ''}`;

  const workSlug = story?.workSlug ?? note?.frontmatter.workSlug;
  const relatedWork = workSlug ? allProjects.find((project) => project.slug === workSlug) : undefined;
  // What a note explains, and the notes that explain a story.
  const relatedStory = note?.frontmatter.storySlug
    ? journalEntries.find((item) => item.slug === note.frontmatter.storySlug)
    : undefined;
  const methodNotes = (story?.postSlugs ?? [])
    .map((postSlug) => journalEntries.find((item) => item.slug === postSlug))
    .filter((item): item is JournalEntry => Boolean(item));

  const facts: [string, string][] = [];
  if (story) {
    facts.push(['Published', entry.date], ['Authors', formatStoryByline(story.byline)], ['Format', story.format]);
    if (story.subject.length > 0) facts.push(['Subjects', story.subject.join('; ')]);
    if (story.sources?.length) facts.push(['Sources', story.sources.join('; ')]);
    if (story.award) facts.push(['Award', story.award]);
    if (story.external) facts.push(['Reads at', new URL(story.url).host]);
  }

  const more = journalEntries.filter((item) => item.slug !== entry.slug).slice(0, 2);

  return (
    <article className="entry">
      <div className="wrap">
        <Frame
          src={entry.cover}
          // The title is the page's heading.
          alt=""
          width={1600}
          height={900}
          ratio="16 / 9"
          sizes={COVER_SIZES.hero}
          priority
        />
      </div>

      <header className="entry__head wrap">
        <h1 className="t-display">{entry.title}</h1>
        <p className="work-page__lede">{entry.summary}</p>
        <p className="t-meta">{meta}</p>

        {story && (!Body || relatedWork) && (
          <div className="work-page__links">
            {!Body &&
              (story.external ? (
                <Button variant="quiet" href={story.url} external icon="arrow-up-right">
                  Read the story
                </Button>
              ) : (
                <Button variant="quiet" to={story.url} icon="arrow-right">
                  Read the story
                </Button>
              ))}
            {relatedWork && (
              <Button variant="quiet" to={`/works/${relatedWork.slug}`} icon="arrow-right">
                How it was made
              </Button>
            )}
          </div>
        )}
      </header>

      {Body && (
        <div className="entry__body wrap">
          <ChapterNav key={slug} containerRef={reading.ref} />
          <div ref={reading.ref} className="mdx-prose">
            <Body />
          </div>
        </div>
      )}

      {methodNotes.length > 0 && (
        <section className="work-page__text wrap">
          <div className="work-section">
            <h2 className="t-h2">Method notes</h2>
            <ul className="work-page__notes">
              {methodNotes.map((item) => (
                <li key={item.slug}>
                  <Link to={item.href} className="t-h3 focus-ring">
                    {item.title}
                  </Link>
                  <p className="t-meta">{item.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {facts.length > 0 && (
        <div className="work-page__text wrap">
          <aside className="source-note" aria-labelledby="colophon-heading">
            <h2 id="colophon-heading" className="t-h3">
              Colophon
            </h2>
            <dl className="facts">
              {facts.map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}

      {note && (relatedWork || relatedStory) && (
        <section className="home-section wrap">
          <div className="section-head">
            <h2 className="t-h2">What this note is about</h2>
          </div>
          <div className="work-grid work-grid--flush">
            {relatedWork && <WorkCard project={relatedWork} />}
            {relatedStory && (
              <JournalCard
                title={relatedStory.title}
                href={relatedStory.href}
                cover={relatedStory.cover}
                kind={relatedStory.kind}
                date={relatedStory.date}
              />
            )}
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="home-section wrap">
          <div className="section-head">
            <h2 className="t-h2">More from the journal</h2>
            <Button variant="quiet" to="/journal" icon="arrow-right">
              All entries
            </Button>
          </div>
          <div className="work-grid work-grid--flush">
            {more.map((item) => (
              <JournalCard
                key={item.slug}
                title={item.title}
                href={item.href}
                cover={item.cover}
                kind={item.kind}
                date={item.date}
              />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
