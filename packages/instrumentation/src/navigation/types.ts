/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

export type ApplyCustomLogRecordDataFunction = (logRecord: LogRecord) => void;

export type SanitizeUrlFunction = (url: string) => string;

export type NavigationType = 'push' | 'replace' | 'reload' | 'traverse';

/**
 * NavigationInstrumentation Configuration
 */
export interface NavigationInstrumentationConfig extends InstrumentationConfig {
  /** Hook to modify log records before they are emitted. */
  applyCustomLogRecordData?: ApplyCustomLogRecordDataFunction;
  /** Use the Navigation API `currententrychange` event if available (experimental). Defaults to false. */
  useNavigationApiIfAvailable?: boolean;
  /** Custom function to sanitize URLs before adding to log records. */
  sanitizeUrl?: SanitizeUrlFunction;
}
