/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/**
 * WebVitalsInstrumentation Configuration
 */
export interface WebVitalsInstrumentationConfig extends InstrumentationConfig {
  /**
   * @experimental
   * When true, sets the log record body to the JSON-stringified
   * `web-vitals` attribution object for the metric.
   *
   * Note: `applyCustomLogRecordData` runs after the body is set.
   * If the hook assigns a new `body`, it will overwrite the attribution data.
   */
  includeRawAttribution?: boolean;

  /**
   * When true, reports the metric value on every change rather than only once
   * per page lifecycle.
   * See: https://github.com/GoogleChrome/web-vitals#report-the-value-on-every-change
   */
  reportAllChanges?: boolean;

  /**
   * Hook to modify log records before they are emitted.
   * Use this to add custom attributes or modify the log record.
   */
  applyCustomLogRecordData?: (logRecord: LogRecord) => void;
}
