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
}
