import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * An old address, sent on to where its page lives now.
 *
 * Keeps the slug when the route has one, and the query and hash either way,
 * so a deep link to a section of a story still lands on that section.
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const { slug } = useParams<{ slug?: string }>();
  const { search, hash } = useLocation();
  return <Navigate to={`${slug ? `${to}/${slug}` : to}${search}${hash}`} replace />;
}
