/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BundleScenario } from './index.ts';

export const webVitalsOnlyScenario: BundleScenario = {
  name: 'single-instrumentation-web-vitals',
  appCode: `
    import { WebVitalsInstrumentation } from '@opentelemetry/instrumentation-browser/experimental/web-vitals';
    const inst = new WebVitalsInstrumentation();
    inst.enable();
    console.log('web-vitals loaded');
  `,
  expectedInBundle: ['WebVitalsInstrumentation', 'browser.web_vital'],
  notExpectedInBundle: [
    'UserActionInstrumentation',
    'browser.user_action.click',
    'NavigationTimingInstrumentation',
    'browser.navigation_timing',
  ],
};
