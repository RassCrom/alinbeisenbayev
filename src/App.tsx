import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import ContactBand, { showContactBand } from './components/ContactBand/ContactBand';
import Footer from './components/Footer/Footer';
import LegacyRedirect from './components/LegacyRedirect/LegacyRedirect';
import PageFallback from './components/PageFallback/PageFallback';
import ScrollManager from './components/ScrollManager/ScrollManager';
// Not lazy: this is the fallback route, so it must not depend on a chunk fetch
// that could itself fail. It is small.
import NotFoundPage from './pages/NotFoundPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const WorksPage = lazy(() => import('./pages/WorksPage'));
const WorkDetailPage = lazy(() => import('./pages/WorkDetailPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ConnectPage = lazy(() => import('./pages/ConnectPage'));
const MapAwardsPage = lazy(() => import('./pages/MapAwardsPage'));
const JournalPage = lazy(() => import('./pages/JournalPage'));
const JournalEntryPage = lazy(() => import('./pages/JournalEntryPage'));

/** What every page ends with: the call to action, then the footer. */
function PageEnd() {
  const { pathname } = useLocation();
  // The awards map fills the viewport; anything under it would only be
  // reachable by scrolling past the map.
  const fullScreen = pathname === '/journal/map-awards';
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
            <Route path="/journal" element={<JournalPage />} />
            {/* The awards calendar is a page of its own; it must match before :slug. */}
            <Route path="/journal/map-awards" element={<MapAwardsPage />} />
            <Route path="/journal/:slug" element={<JournalEntryPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/connect" element={<ConnectPage />} />
            {/* Interim: plan 4 gives this route its own page. */}
            <Route path="/contact" element={<ConnectPage />} />
            {/* Old addresses. The same redirects exist at the host, for visitors
                who arrive by link rather than by a click inside the site. */}
            <Route path="/stories" element={<LegacyRedirect to="/journal" />} />
            <Route path="/stories/:slug" element={<LegacyRedirect to="/journal" />} />
            <Route path="/blog" element={<LegacyRedirect to="/journal" />} />
            <Route path="/blog/:slug" element={<LegacyRedirect to="/journal" />} />
            <Route path="/gallery" element={<Navigate to="/works" replace />} />
            <Route path="/skills" element={<Navigate to="/about" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <PageEnd />
    </>
  );
}
