import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: ['src/*/index.ts'],
  dts: true,
  noExternal: ['@opentelemetry/web-utils'],
});
