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
   * Use a custom `LogRecordProcessor` to redact attributes before export.
   */
  includeAttribution?: boolean;

  /**
   * @experimental
   * When true, sets the log record body to the JSON-stringified
   * `web-vitals` attribution object for the metric. Does not add attribution
   * attributes. Defaults to `false`.
   *
   * The raw body can contain more data than the selected attributes.
   * Use a custom `LogRecordProcessor` to redact it before export.
   *
   * Note: `applyCustomLogRecordData` runs after the body is set.
   * If the hook assigns a new `body`, it will overwrite the attribution data.
   */
  includeRawAttribution?: boolean;

  /**
   * Hook to modify log records before they are emitted.
   * Use this to add custom attributes or modify the log record.
   *
   * @deprecated Use a custom `LogRecordProcessor` registered with `LoggerProvider` instead.
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

  /**
   * When true, metrics are reported again after each soft navigation (a
   * route change in a single-page app). CLS and INP start again from zero.
   * FCP and LCP are the paints after the soft navigation. TTFB is not reported
   * for soft navigations. Metrics for the first page are final at the first
   * soft navigation, so its CLS and INP can be lower than without this option.
   *
   * Adds `browser.web_vital.navigation_url`. Use it to group metrics by
   * route, because a metric can be reported after the URL has changed.
   * `browser.web_vital.navigation_id` is added when the browser exposes a
   * navigation id, with or without this option.
   *
   * Requires Chromium 151 or later. Other browsers ignore this option.
   * Defaults to `false`.
   *
   * See https://github.com/GoogleChrome/web-vitals#report-metrics-for-soft-navigations
   */
  reportSoftNavs?: boolean;

  /**
   * Custom function to sanitize `browser.web_vital.navigation_url` before
   * adding it to log records.
   */
  sanitizeUrl?: (url: string) => string;
}
