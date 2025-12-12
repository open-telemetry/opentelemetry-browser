import baselinePlugin from 'eslint-plugin-baseline-js';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['packages/**/*.ts', 'packages/**/*.js'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: { 'baseline-js': baselinePlugin },
    ...baselinePlugin.configs['recommended-ts']({
      available: 'widely',
      level: 'error',
    }),
  },
];
