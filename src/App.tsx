import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import Footer from './components/Footer/Footer';
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

function AppFooter() {
  const { pathname } = useLocation();
  // The awards map fills the viewport; a footer under it would only be
  // reachable by scrolling past the map.
  if (pathname === '/blog/map-awards') return null;
  return <Footer />;
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="mono-label">Loading…</span>
    </div>
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
      <AppFooter />
    </>
  );
}
