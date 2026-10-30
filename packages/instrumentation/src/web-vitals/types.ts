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
   * When true, adds selected INP attribution fields as experimental log
   * record attributes. Does not include the raw attribution body.
   * Defaults to `false`.
   *
   * Interaction selectors and script URLs can contain sensitive data.
   * Use `applyCustomLogRecordData` to redact attributes before emission.
   */
  includeAttribution?: boolean;

  /**
   * @experimental
   * When true, sets the log record body to the JSON-stringified
   * `web-vitals` attribution object for the metric. Does not add attribution
   * attributes. Defaults to `false`.
   *
   * The raw body can contain more data than the selected attributes.
   * Use `applyCustomLogRecordData` to redact it before emission.
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
   * When true, CLS, INP and LCP are reported each time their value changes,
   * not only when the value is final. FCP and TTFB are not affected. `delta`
   * is the change since the previous report for the same metric `id`.
   *
   * `web-vitals` recommends this for debugging, not for production.
   * Defaults to `false`.
   *
   * See https://github.com/GoogleChrome/web-vitals#report-the-value-on-every-change
   */
  reportAllChanges?: boolean;
}
