/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/**
 * WebVitalsInstrumentation Configuration
 */
export interface WebVitalsInstrumentationConfig extends InstrumentationConfig {
  /**
   * @experimental
   * When true, sets the log record body to the JSON-stringified
   * `web-vitals` attribution object for the metric.
   */
  includeRawAttribution?: boolean;

  /**
   * Passed through to `web-vitals` to report metric updates according to its
   * reporting behavior. `delta` is the change since its previous report.
   * Set before listeners are first registered, later changes have no effect.
   * Defaults to `false`.
   */
  reportAllChanges?: boolean;
}
