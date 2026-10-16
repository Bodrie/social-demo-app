import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/app';
import { reloadForNewVersion } from './lib/new-version';

// Vite could not preload a chunk of this build: a deploy replaced it. Run the new one instead
// (the route error page covers it if the reload was already tried).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
