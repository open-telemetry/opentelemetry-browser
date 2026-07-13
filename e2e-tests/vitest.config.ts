import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: 'e2e-tests/public',
  optimizeDeps: {
    // Prevent Vite from pre-bundling workspace packages from their dist/
    // output. Without this, Vite follows the package exports map and uses
    // dist files, which bypasses the resolve.alias entries below that point
    // to source.
    exclude: [
      '@opentelemetry/browser-sdk',
      '@opentelemetry/browser-instrumentation',
    ],
    // Pre-bundle transitive deps of the workspace source files so Vite does
    // not discover them dynamically mid-run and force a reload.
    include: [
      '@opentelemetry/core',
      '@opentelemetry/resources',
      '@opentelemetry/sdk-trace',
      '@opentelemetry/semantic-conventions',
    ],
  },
  resolve: {
    alias: {
      '@opentelemetry/browser-instrumentation/experimental/errors':
        fileURLToPath(
          new URL(
            '../packages/instrumentation/src/errors/index.ts',
            import.meta.url,
          ),
        ),
      '@opentelemetry/browser-sdk': fileURLToPath(
        new URL('../packages/sdk/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['e2e-tests/**/*.test.ts'],
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
