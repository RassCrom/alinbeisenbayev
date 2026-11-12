import { Link } from 'react-router-dom';
import Frame from '../Frame/Frame';
import { COVER_SIZES } from '../../utils/images';

export interface JournalCardProps {
  title: string;
  href: string;
  cover: string;
  /** Said once, in plain text: a published piece, a method note, or a tool. */
  kind: 'Story' | 'Note' | 'Tool';
  /** The entry lives on another site. */
  external?: boolean;
}

export default function JournalCard({ title, href, cover, kind, external = false }: JournalCardProps) {
  const body = (
    <>
      <Frame src={cover} alt="" width={1200} height={800} ratio="3 / 2" sizes={COVER_SIZES.cardThird} />
      <div className="journal-card__text">
        <h3 className="t-h3">{title}</h3>
        <p className="t-meta">{kind}</p>
      </div>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className="journal-card">
      {body}
    </a>
  ) : (
    <Link to={href} className="journal-card">
      {body}
    </Link>
  );
}
