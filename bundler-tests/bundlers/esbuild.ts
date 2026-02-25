/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import type { BundlerAdapter } from './index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlingTestsRoot = path.resolve(__dirname, '..');

const sharedOptions: esbuild.BuildOptions = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  treeShaking: true,
  metafile: true,
  logLevel: 'silent',
  nodePaths: [path.join(bundlingTestsRoot, 'node_modules')],
};

export const esbuildAdapter: BundlerAdapter = {
  name: 'esbuild',
  async bundle(entryPoint: string, outFile: string): Promise<void> {
    await esbuild.build({
      ...sharedOptions,
      entryPoints: [entryPoint],
      outfile: outFile,
    });
  },
  async bundleMinified(entryPoint: string, outFile: string): Promise<void> {
    await esbuild.build({
      ...sharedOptions,
      entryPoints: [entryPoint],
      outfile: outFile,
      minify: true,
    });
  },
};
