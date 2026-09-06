import { lazy, Suspense } from 'react';
import { useViewMode } from '../atlas/viewMode';
import LandingPage from './LandingPage';

/*
 * `/` has two faces: the atlas (map view) and the landing page (sheet view);
 * without WebGL the map view is a pre-baked poster with links (stage 7).
 * Which one shows is the visitor's persisted choice, defaulting per
 * src/atlas/viewMode.ts. The atlas is a separate chunk, so the sheet never
 * pays for WebGL code it does not run.
 */
const AtlasView = lazy(() => import('../atlas/AtlasView'));
const AtlasPoster = lazy(() => import('../atlas/AtlasPoster'));

function AtlasFallback() {
  // Inline styles: the atlas stylesheet arrives with the chunk this waits for.
  return (
    <div
      role="status"
      style={{
        height: 'calc(100vh - 4rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#071224',
        color: 'rgba(235, 225, 201, 0.68)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
      }}
    >
      Charting the archipelago…
    </div>
  );
}

export default function HomePage() {
  const { mode, supported } = useViewMode();
  if (mode === 'map') {
    return (
      <Suspense fallback={<AtlasFallback />}>
        {supported ? <AtlasView /> : <AtlasPoster />}
      </Suspense>
    );
  }
  return <LandingPage />;
}
