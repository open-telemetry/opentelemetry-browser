import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: {
    logs: 'src/initializer/logs.ts',
    traces: 'src/initializer/traces.ts',
    start: 'src/initializer/start.ts',
    'session/index': 'src/session/index.ts',
  },
});
