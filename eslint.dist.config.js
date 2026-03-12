import baselinePlugin from 'eslint-plugin-baseline-js';

// Extends base config and adds compiled output checking
export default [
  // Compiled output - catches non-baseline APIs from dependencies
  {
    files: ['packages/**/dist/**/*.js'],
    plugins: {
      'baseline-js': baselinePlugin,
    },
    rules: {
      'baseline-js/use-baseline': [
        'error',
        {
          available: 'widely',
          includeWebApis: { preset: 'auto' },
          includeJsBuiltins: { preset: 'auto' },
        },
      ],
    },
  },
];
