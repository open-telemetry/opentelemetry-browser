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
  // resource-timing intentionally uses requestIdleCallback (not widely available)
  // with a Safari fallback shim — suppress the dist-level check for this package.
  {
    files: ['packages/instrumentation-resource-timing/dist/**/*.js'],
    rules: {
      'baseline-js/use-baseline': [
        'error',
        {
          available: 'widely',
          includeWebApis: { preset: 'auto' },
          includeJsBuiltins: { preset: 'auto' },
          ignoreFeatures: ['requestidlecallback'],
        },
      ],
    },
  },
];
