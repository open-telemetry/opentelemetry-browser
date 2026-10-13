/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';

/**
 * WebVitalsInstrumentation Configuration
 */
export interface WebVitalsInstrumentationConfig {
  /**
   * @experimental
   * When true, sets the log record body to the JSON-stringified
   * `web-vitals` attribution object for the metric. For INP, also adds
   * selected attribution fields as experimental log record attributes.
   *
   * Interaction selectors and script URLs can contain sensitive data.
   * Use `applyCustomLogRecordData` to redact attributes and the raw body.
   *
   * Note: `applyCustomLogRecordData` runs after the body is set.
   * If the hook assigns a new `body`, it will overwrite the attribution data.
   */
  includeRawAttribution?: boolean;

  /**
   * Hook to modify log records before they are emitted.
   * Use this to add custom attributes or modify the log record.
   */
  applyCustomLogRecordData?: (logRecord: LogRecord) => void;

  /**
   * Passed through to `web-vitals` to report metric updates according to its
   * reporting behavior. `delta` is the change since its previous report.
   * Defaults to `false`.
   */
  reportAllChanges?: boolean;
}
