import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  sourcemap: true,
  platform: 'browser',
  publint: true,
  target: 'es2022',
  attw: {
    profile: 'esm-only',
  },
  unbundle: true,
});
