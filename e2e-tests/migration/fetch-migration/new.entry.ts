/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { testSdkSetup } from '../../utils/test-otel-setup.ts';
import { runScenario } from './scenarios.ts';

testSdkSetup([new FetchInstrumentation()]);

window.__fetchMigrationHarness = { runScenario };
window.__fetchMigrationReady = true;
