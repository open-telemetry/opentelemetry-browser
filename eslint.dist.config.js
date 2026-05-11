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
    files: ['packages/instrumentation/dist/resource-timing/**/*.js'],
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
  // navigation intentionally uses the Navigation API (not widely available)
  // behind an opt-in config flag, with a history-patching fallback.
  {
    files: ['packages/instrumentation/dist/navigation/**/*.js'],
    rules: {
      'baseline-js/use-baseline': [
        'error',
        {
          available: 'widely',
          includeWebApis: { preset: 'auto' },
          includeJsBuiltins: { preset: 'auto' },
          ignoreFeatures: ['navigation'],
        },
      ],
    },
  },
];
