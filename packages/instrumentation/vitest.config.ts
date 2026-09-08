import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

// Vitest 5 no longer serves msw's worker script at the server root, which
// `setupWorker().start()` needs. Serve the installed copy so it stays in sync
// with the msw dependency instead of vendoring a generated file.
function mswServiceWorker(): Plugin {
  const workerPath = require.resolve('msw/mockServiceWorker.js');

  return {
    name: 'msw-service-worker',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.end(readFileSync(workerPath, 'utf-8'));
      });
    },
  };
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/fetch/**', 'src/web-vitals/**', 'src/xhr/**'],
          browser: { enabled: false },
        },
      },
      {
        plugins: [mswServiceWorker()],
        test: {
          name: 'browser',
          include: [
            'src/fetch/**/*.test.ts',
            'src/web-vitals/**/*.test.ts',
            'src/xhr/**/*.test.ts',
          ],
          browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
