import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: {
    index: 'src/index.ts',
    'browser-detector/index': 'src/browser-detector/index.ts',
    'logs/index': 'src/logs/index.ts',
    'traces/index': 'src/traces/index.ts',
    'document/index': 'src/document/index.ts',
    'session/index': 'src/session/index.ts',
  },
});
