/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BundlerAdapter {
  name: string;
  bundle(entryPoint: string, outFile: string): Promise<void>;
}

export { esbuildAdapter } from './esbuild.ts';
export { rollupAdapter } from './rollup.ts';
