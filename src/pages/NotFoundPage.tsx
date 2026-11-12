import Button from '../components/Button/Button';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * The page for an address that is not on the site: a mistyped link, a work
 * that was renamed, an old bookmark. It says so and offers the ways back.
 *
 * Also rendered by the work and journal pages for a slug nobody has, so a
 * miss looks the same wherever it happens. Marked noindex: the server
 * answers 200 for every path, so this is the only signal a crawler gets.
 */
export default function NotFoundPage() {
  usePageMeta('Page not found', 'This address is not on the site.', { noindex: true });

  return (
    <div className="not-found wrap">
      <h1 className="t-display">Off the edge of the map</h1>
      <p className="work-page__lede">This address is not on the site. The page may have been renamed or removed.</p>
      <div className="not-found__ways">
        <Button variant="quiet" to="/works" icon="arrow-right">
          See the work
        </Button>
        <Button variant="quiet" to="/journal" icon="arrow-right">
          Read the journal
        </Button>
        <Button variant="quiet" to="/" icon="arrow-right">
          Back to start
        </Button>
      </div>
    </div>
  );
}
