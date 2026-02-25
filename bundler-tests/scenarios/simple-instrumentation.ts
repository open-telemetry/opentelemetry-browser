/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BundleScenario } from './index.ts';

export const simpleInstrumentationScenario: BundleScenario = {
  name: 'single-instrumentation-user-action',
  appCode: `
    import { UserActionInstrumentation } from '@opentelemetry/instrumentation-browser/experimental/user-action';
    const inst = new UserActionInstrumentation();
    inst.enable();
    console.log('user-action loaded');
  `,
  expectedInBundle: ['UserActionInstrumentation', 'browser.user_action.click'],
  notExpectedInBundle: [
    'NavigationTimingInstrumentation',
    'browser.navigation_timing',
  ],
};
