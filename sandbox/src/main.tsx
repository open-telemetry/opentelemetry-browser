import './app/style.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

// Start the mock OTLP intake before rendering so the MSW worker is intercepting
// before the SDK fires its first export. Enabled in dev by default, and on any
// build via `?intake=mock` (handy for the deployed GitHub Pages showcase).
async function enableIntakeMock(): Promise<boolean> {
  const forced =
    new URLSearchParams(window.location.search).get('intake') === 'mock';
  if (!import.meta.env.DEV && !forced) {
    return false;
  }
  const { worker } = await import('./mocks/browser.ts');
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    // Respect the /opentelemetry-browser/ base path on GitHub Pages.
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
  return true;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

enableIntakeMock()
  .catch(() => false)
  .then((intakeMock) => {
    createRoot(rootElement).render(<App intakeMock={intakeMock} />);
  });
