import { defineConfig } from 'tsdown';

export default defineConfig({
  attw: {
    profile: 'esm-only',
  },
  clean: true,
  dts: true,
  platform: 'browser',
  publint: true,
  sourcemap: true,
  target: 'es2022',
  unbundle: true,
});
