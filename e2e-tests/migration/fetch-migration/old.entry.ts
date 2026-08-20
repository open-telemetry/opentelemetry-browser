/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { testSdkSetup } from '../../utils/test-otel-setup.ts';
import { runScenario, TEST_IMPL_ATTR } from './scenarios.ts';

testSdkSetup([
  new FetchInstrumentation({
    applyCustomAttributesOnSpan: (span) => {
      span.setAttribute(TEST_IMPL_ATTR, 'old');
    },
  }),
]);

window.__fetchMigrationHarness = { runScenario };
window.__fetchMigrationReady = true;
