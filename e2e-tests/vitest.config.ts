import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: 'e2e-tests/public',
  resolve: {
    alias: {
      '@opentelemetry/browser-instrumentation/experimental/fetch':
        fileURLToPath(
          new URL(
            '../packages/instrumentation/src/fetch/index.ts',
            import.meta.url,
          ),
        ),
    },
  },
  test: {
    onConsoleLog: () => (process.env['VERBOSE'] ? undefined : false),
    include: ['e2e-tests/**/*.test.ts'],
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
