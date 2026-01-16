import baselinePlugin from 'eslint-plugin-baseline-js';
import baseConfig from './eslint.config.js';

// Extends base config and adds compiled output checking
export default [
  ...baseConfig,
  // Compiled output - catches non-baseline APIs from dependencies
  {
    files: ['packages/*/dist/**/*.js'],
    ignores: ['**/*.d.ts'],
    plugins: {
      'baseline-js': baselinePlugin,
    },
    rules: {
      'baseline-js/use-baseline': [
        'error',
        {
          available: 'widely',
        },
      ],
    },
  },
];
