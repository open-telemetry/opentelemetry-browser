/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BundlerAdapter } from '../bundlers/index.ts';
import { esbuildAdapter, rollupAdapter } from '../bundlers/index.ts';
import type { BundleScenario } from '../scenarios/index.ts';
import {
  multipleInstrumentationsScenario,
  sdkWithInstrumentationsScenario,
  simpleInstrumentationScenario,
  webVitalsOnlyScenario,
} from '../scenarios/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

const bundlers: BundlerAdapter[] = [esbuildAdapter, rollupAdapter];

const scenarios: BundleScenario[] = [
  simpleInstrumentationScenario,
  multipleInstrumentationsScenario,
  sdkWithInstrumentationsScenario,
  webVitalsOnlyScenario,
];

beforeAll(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
});

for (const bundler of bundlers) {
  describe(`bundler: ${bundler.name}`, () => {
    for (const scenario of scenarios) {
      it(`scenario: ${scenario.name}`, async () => {
        const entryFile = path.join(
          distDir,
          `${bundler.name}-${scenario.name}-entry.js`,
        );
        const outFile = path.join(
          distDir,
          `${bundler.name}-${scenario.name}-out.js`,
        );

        fs.writeFileSync(entryFile, scenario.appCode);

        await bundler.bundle(entryFile, outFile);

        const minFile = outFile.replace(/\.js$/, '.min.js');
        await bundler.bundleMinified(entryFile, minFile);

        const output = fs.readFileSync(outFile, 'utf-8');

        for (const expected of scenario.expectedInBundle) {
          expect(output, `Expected "${expected}" to be in bundle`).toContain(
            expected,
          );
        }

        for (const notExpected of scenario.notExpectedInBundle) {
          expect(
            output,
            `Expected "${notExpected}" NOT to be in bundle`,
          ).not.toContain(notExpected);
        }
      });
    }
  });
}
