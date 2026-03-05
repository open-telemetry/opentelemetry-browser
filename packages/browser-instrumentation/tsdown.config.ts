import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: [
    'src/navigation-timing/index.ts',
    'src/user-action/index.ts',
    'src/web-vitals/index.ts',
  ],
  dts: true,
});
