import Icon from '../Icon/Icon';

export interface DownloadCardProps {
  href: string;
  title: string;
  size: string;
  /** What is inside, in a few words. */
  contents: string;
}

/** A file to download from a blog post: what it is, how big, what is in it. */
export default function DownloadCard({ href, title, size, contents }: DownloadCardProps) {
  return (
    <a className="download-card focus-ring" href={href} download>
      <span className="download-card__text">
        <span className="download-card__title">
          {title}
          <span className="download-card__size">{size}</span>
        </span>
        <span className="download-card__contents">{contents}</span>
      </span>
      <span className="download-card__icon">
        <Icon name="download" />
      </span>
    </a>
  );
}
