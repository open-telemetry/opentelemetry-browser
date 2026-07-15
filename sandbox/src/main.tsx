import './app/style.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

// Start the mock OTLP intake before rendering so the MSW worker is intercepting
// before the SDK fires its first export. Enabled by default (in dev and on the
// deployed GitHub Pages showcase); opt out with `?intake=off`.
async function enableIntakeMock(): Promise<boolean> {
  const disabled =
    new URLSearchParams(window.location.search).get('intake') === 'off';
  if (disabled) {
    // Opted out via `?intake=off`: tear down any MSW worker left registered by
    // a previous visit so it can't keep controlling the page and silently
    // intercepting real OTLP exports.
    await unregisterIntakeWorker();
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

// Unregister any service worker previously installed by the mock intake.
async function unregisterIntakeWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((r) => r.active?.scriptURL.includes('mockServiceWorker'))
      .map((r) => r.unregister()),
  );
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
