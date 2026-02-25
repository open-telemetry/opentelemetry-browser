/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BundleScenario } from './index.ts';

export const multipleInstrumentationsScenario: BundleScenario = {
  name: 'multiple-instrumentations',
  appCode: `
    import { UserActionInstrumentation } from '@opentelemetry/instrumentation-browser/experimental/user-action';
    import { NavigationTimingInstrumentation } from '@opentelemetry/instrumentation-browser/experimental/navigation-timing';
    const ua = new UserActionInstrumentation();
    const nt = new NavigationTimingInstrumentation();
    ua.enable();
    nt.enable();
    console.log('both loaded');
  `,
  expectedInBundle: [
    'UserActionInstrumentation',
    'NavigationTimingInstrumentation',
    'browser.user_action.click',
    'browser.navigation_timing',
  ],
  notExpectedInBundle: [],
};
