import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useViewMode } from './atlas/viewMode';
import Nav from './components/Nav/Nav';
import Footer from './components/Footer/Footer';
import CustomCursor from './components/CustomCursor/CustomCursor';
import ScrollManager from './components/ScrollManager/ScrollManager';
// Not lazy: this is the fallback route, so it must not depend on a chunk fetch
// that could itself fail. It is small.
import NotFoundPage from './pages/NotFoundPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const WorksPage = lazy(() => import('./pages/WorksPage'));
const WorkDetailPage = lazy(() => import('./pages/WorkDetailPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const SkillsPage = lazy(() => import('./pages/SkillsPage'));
const ConnectPage = lazy(() => import('./pages/ConnectPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));

/**
 * The atlas fills the viewport and is a screen, not a document: a footer
 * under it would only be reachable by scrolling past the map. The sheet
 * view keeps the footer as before.
 */
function AppFooter() {
  const { pathname } = useLocation();
  const { mode, supported } = useViewMode();
  if (pathname === '/' && mode === 'map' && supported) return null;
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
      <ScrollManager />
      <CustomCursor />
      <Nav />
      <main className="min-h-screen pt-16">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/works/:slug" element={<WorkDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <AppFooter />
    </>
  );
}
