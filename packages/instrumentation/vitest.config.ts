import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/web-vitals/**'],
          browser: { enabled: false },
        },
      },
      {
        test: {
          name: 'browser',
          include: ['src/web-vitals/**/*.test.ts'],
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
