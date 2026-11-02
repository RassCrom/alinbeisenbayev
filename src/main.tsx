import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
/*
 * Fonts are bundled rather than pulled from Google Fonts: no render-blocking
 * third-party stylesheet, no second and third origin to connect to, and no
 * visitor IPs sent to Google (a GDPR problem in the EU). DM Mono has no
 * variable build; the site only uses 400, 500 and 400 italic.
 */
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/lora/wght.css';
import '@fontsource-variable/lora/wght-italic.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/dm-mono/400-italic.css';
import './styles/global.css';

/*
 * After a deploy, a tab opened on the old build asks for chunk hashes that no
 * longer exist. Reload once to pick up the new index.html; the stamp stops a
 * loop if the chunk is missing for some other reason.
 */
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('chunk-reload') ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem('chunk-reload', String(Date.now()));
  } catch {
    // Storage blocked: still worth one reload.
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
