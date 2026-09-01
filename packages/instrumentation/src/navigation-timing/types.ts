/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

export type ApplyCustomLogRecordDataFunction = (logRecord: LogRecord) => void;

/**
 * NavigationTimingInstrumentation Configuration
 */
export interface NavigationTimingInstrumentationConfig
  extends InstrumentationConfig {
  /** Hook to modify log records before they are emitted. */
  applyCustomLogRecordData?: ApplyCustomLogRecordDataFunction;
}
