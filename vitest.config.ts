import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: ['node_modules/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
