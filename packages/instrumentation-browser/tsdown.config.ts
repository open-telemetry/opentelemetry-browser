import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
  ...baseConfig,
  entry: ['src/user-action/index.ts', 'src/navigation-timing/index.ts'],
  dts: true,
});
