/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';

/**
 * Hook to modify log records before they are emitted.
 *
 * @deprecated Use a custom `LogRecordProcessor` registered with `LoggerProvider` instead.
 */
export type ApplyCustomLogRecordDataFunction = (logRecord: LogRecord) => void;

export type SanitizeUrlFunction = (url: string) => string;

export type NavigationType = 'push' | 'replace' | 'reload' | 'traverse';

/**
 * NavigationInstrumentation Configuration
 */
export interface NavigationInstrumentationConfig {
  /**
   * Hook to modify log records before they are emitted.
   *
   * @deprecated Use a custom `LogRecordProcessor` registered with `LoggerProvider` instead.
   */
  applyCustomLogRecordData?: ApplyCustomLogRecordDataFunction;
  /** Use the Navigation API `currententrychange` event if available (experimental). Defaults to false. */
  useNavigationApiIfAvailable?: boolean;
  /** Custom function to sanitize URLs before adding to log records. */
  sanitizeUrl?: SanitizeUrlFunction;
}
