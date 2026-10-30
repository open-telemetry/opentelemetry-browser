/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// CI uses the same tooling to measure two independently installed revisions.
const root = resolve(
  process.env.BUNDLE_SIZE_ROOT ?? dirname(fileURLToPath(import.meta.url)),
);
const checks = [];
for (const directory of ['instrumentation', 'sdk']) {
  const packageRoot = resolve(root, 'packages', directory);
  const manifest = JSON.parse(
    readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
  );
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    const entry = typeof target === 'string' ? target : target.default;
    if (!entry.endsWith('.js')) {
      continue;
    }
    const name = manifest.name + (subpath === '.' ? '' : subpath.slice(1));
    const imports = ['*'];
    if (directory === 'sdk' && subpath === './document') {
      imports.push('{ LocationDocumentProvider }');
    }
    for (const imported of imports) {
      for (const compression of ['gzip', 'brotli']) {
        checks.push({
          name: `${name} [${imported}, ${compression}]`,
          path: resolve(packageRoot, entry),
          import: imported,
          gzip: compression === 'gzip',
          modifyEsbuildConfig: (config) => ({
            ...config,
            platform: 'browser',
            target: 'es2022',
          }),
        });
      }
    }
  }
}

export default checks;
