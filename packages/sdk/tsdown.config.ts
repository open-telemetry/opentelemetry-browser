import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: ['src/sdk/logs.ts', 'src/sdk/traces.ts', 'src/sdk/start.ts'],
});
