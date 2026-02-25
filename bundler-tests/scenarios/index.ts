/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BundleScenario {
  name: string;
  /** The app code that imports from our packages */
  appCode: string;
  /** Strings that MUST appear in the bundle */
  expectedInBundle: string[];
  /** Strings that must NOT appear in the bundle */
  notExpectedInBundle: string[];
}

export { multipleInstrumentationsScenario } from './multiple-instrumentations.ts';
export { sdkWithInstrumentationsScenario } from './sdk-with-instrumentations.ts';
export { simpleInstrumentationScenario } from './simple-instrumentation.ts';
