import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: {
    logs: 'src/sdk/logs.ts',
    traces: 'src/sdk/traces.ts',
    start: 'src/sdk/start.ts',
    'session/index': 'src/session/index.ts',
  },
});
