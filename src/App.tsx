import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import ContactBand, { showContactBand } from './components/ContactBand/ContactBand';
import Footer from './components/Footer/Footer';
import PageFallback from './components/PageFallback/PageFallback';
import ScrollManager from './components/ScrollManager/ScrollManager';
// Not lazy: this is the fallback route, so it must not depend on a chunk fetch
// that could itself fail. It is small.
import NotFoundPage from './pages/NotFoundPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const WorksPage = lazy(() => import('./pages/WorksPage'));
const WorkDetailPage = lazy(() => import('./pages/WorkDetailPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const StoriesPage = lazy(() => import('./pages/StoriesPage'));
const StoryDetailPage = lazy(() => import('./pages/StoryDetailPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ConnectPage = lazy(() => import('./pages/ConnectPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const MapAwardsPage = lazy(() => import('./pages/MapAwardsPage'));

/** What every page ends with: the call to action, then the footer. */
function PageEnd() {
  const { pathname } = useLocation();
  // The awards map fills the viewport; anything under it would only be
  // reachable by scrolling past the map.
  const fullScreen = pathname === '/blog/map-awards' || pathname === '/journal/map-awards';
  return (
    <>
      {showContactBand(pathname) && <ContactBand />}
      {!fullScreen && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollManager />
      <Nav />
      <main id="main" tabIndex={-1} className="min-h-screen pt-[var(--nav-h)] outline-none">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/works/:slug" element={<WorkDetailPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/stories/:slug" element={<StoryDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            {/* Interim: plans 3 and 4 give these routes their own pages. */}
            <Route path="/journal" element={<StoriesPage />} />
            <Route path="/contact" element={<ConnectPage />} />
            <Route path="/skills" element={<Navigate to="/about" replace />} />
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/map-awards" element={<MapAwardsPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <PageEnd />
    </>
  );
}
