import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: ['src/*/index.ts', '!src/{test-utils,utils}/index.ts'],
});
