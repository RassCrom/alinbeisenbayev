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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
