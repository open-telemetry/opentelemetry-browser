/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BundleScenario } from './index.ts';

export const sdkWithInstrumentationsScenario: BundleScenario = {
  name: 'sdk-with-instrumentations',
  appCode: `
    import { configureBrowserSDK } from '@opentelemetry/sdk-browser';
    import { UserActionInstrumentation } from '@opentelemetry/instrumentation-browser/experimental/user-action';
    const { shutdown } = configureBrowserSDK({
      serviceName: 'my-app',
      instrumentations: [new UserActionInstrumentation()],
    });
    console.log('sdk configured');
  `,
  expectedInBundle: [
    'configureBrowserSDK',
    'UserActionInstrumentation',
    'browser.user_action.click',
  ],
  notExpectedInBundle: [
    'NavigationTimingInstrumentation',
    'browser.navigation_timing',
    'WebVitalsInstrumentation',
    'browser.web_vital',
  ],
};
