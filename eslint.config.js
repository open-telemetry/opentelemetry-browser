import baselinePlugin from 'eslint-plugin-baseline-js';
import yalhPlugin from 'eslint-plugin-yet-another-license-header';
import tseslint from 'typescript-eslint';

const defaultLicense = `
/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */
`;

const licensePattern =
  /^\/\*\n \* Copyright The OpenTelemetry Authors(?:, [^\n]+)*\n(?: \* Copyright [^\n]+\n)*(?: \*\n)? \* SPDX-License-Identifier: Apache-2\.0\n \*\/$/;

export default [
  {
    ignores: ['bundler-tests/**'],
  },
  {
    files: ['packages/*/src/**/*.{js,ts,mjs}'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tseslint.parser,
      // enables type-aware linting to detect instance method usage
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      'baseline-js': baselinePlugin,
      'yet-another-license-header': yalhPlugin,
    },
    rules: {
      ...baselinePlugin.configs['recommended-ts']({
        available: 'widely',
        level: 'error',
      }).rules,
      'yet-another-license-header/header': [
        'error',
        {
          header: defaultLicense,
          allowedHeaderPatterns: [licensePattern],
        },
      ],
    },
  },
];
