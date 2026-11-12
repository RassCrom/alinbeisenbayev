import Skeleton from '../Skeleton/Skeleton';

/**
 * Shown while a route's code arrives: the outline of a page (a title and a
 * cover), not the word "Loading".
 */
export default function PageFallback() {
  return (
    <div className="page-fallback wrap" role="status" aria-label="Loading page">
      <Skeleton className="page-fallback__title" />
      <Skeleton className="page-fallback__cover" />
    </div>
  );
}
