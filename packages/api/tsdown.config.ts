import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: ['src/*/index.ts'],
  // With one entry folder, tsdown uses it as root and builds dist/index.js, not dist/instrumentation/index.js.
  root: 'src',
});
