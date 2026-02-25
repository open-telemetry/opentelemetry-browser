/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodeResolve from '@rollup/plugin-node-resolve';
import { rollup } from 'rollup';
import type { BundlerAdapter } from './index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlingTestsRoot = path.resolve(__dirname, '..');

export const rollupAdapter: BundlerAdapter = {
  name: 'rollup',
  async bundle(entryPoint: string, outFile: string): Promise<void> {
    const bundle = await rollup({
      input: entryPoint,
      plugins: [
        nodeResolve({
          rootDir: bundlingTestsRoot,
          modulePaths: [path.join(bundlingTestsRoot, 'node_modules')],
          browser: true,
          preferBuiltins: false,
        }),
      ],
      onwarn: () => {},
    });

    await bundle.write({
      file: outFile,
      format: 'esm',
    });

    await bundle.close();
  },
};
