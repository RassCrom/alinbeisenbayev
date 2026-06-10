import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import Footer from './components/Footer/Footer';
import CustomCursor from './components/CustomCursor/CustomCursor';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const WorksPage = lazy(() => import('./pages/WorksPage'));
const WorkDetailPage = lazy(() => import('./pages/WorkDetailPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const SkillsPage = lazy(() => import('./pages/SkillsPage'));
const ConnectPage = lazy(() => import('./pages/ConnectPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
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
      <ScrollToTop />
      <CustomCursor />
      <Nav />
      <main className="min-h-screen pt-16">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/works/:slug" element={<WorkDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
