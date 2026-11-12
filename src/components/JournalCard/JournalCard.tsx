import { Link } from 'react-router-dom';
import Frame from '../Frame/Frame';
import { COVER_SIZES } from '../../utils/images';

export interface JournalCardProps {
  title: string;
  href: string;
  cover: string;
  /** Said once, in plain text: a published piece, a method note, or a tool. */
  kind: 'Story' | 'Note' | 'Tool';
  /** Shown after the kind: "Story, November 2026". */
  date?: string;
  /** The lead card carries its standfirst; the rest are title and one line. */
  summary?: string;
  /** `lead` spans the row, cover beside the text on wide screens. */
  size?: 'lead' | 'third';
  /** The entry lives on another site. */
  external?: boolean;
}

export default function JournalCard({
  title,
  href,
  cover,
  kind,
  date,
  summary,
  size = 'third',
  external = false,
}: JournalCardProps) {
  const lead = size === 'lead';
  const className = lead ? 'journal-card journal-card--lead' : 'journal-card';
  const body = (
    <>
      <Frame
        src={cover}
        alt=""
        width={1200}
        height={lead ? 675 : 800}
        ratio={lead ? '16 / 9' : '3 / 2'}
        sizes={lead ? COVER_SIZES.cardWide : COVER_SIZES.cardThird}
        priority={lead}
      />
      <div className="journal-card__text">
        <h3 className={lead ? 't-h2' : 't-h3'}>{title}</h3>
        {lead && summary && <p className="journal-card__summary">{summary}</p>}
        <p className="t-meta">{date ? `${kind}, ${date}` : kind}</p>
      </div>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link to={href} className={className}>
      {body}
    </Link>
  );
}
