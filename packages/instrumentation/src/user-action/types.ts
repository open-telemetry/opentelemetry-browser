/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LogRecord } from '@opentelemetry/api-logs';

export type AutoCapturedUserAction = 'click';

export type MouseButton = 'left' | 'middle' | 'right';

/**
 * Hook to modify log records before they are emitted.
 *
 * @deprecated Use a custom `LogRecordProcessor` registered with `LoggerProvider` instead.
 */
export type ApplyCustomLogRecordDataFunction = (logRecord: LogRecord) => void;

/**
 * UserActionInstrumentation Configuration
 */
export interface UserActionInstrumentationConfig {
  autoCapturedActions?: AutoCapturedUserAction[];
  /**
   * Hook to modify log records before they are emitted.
   *
   * @deprecated Use a custom `LogRecordProcessor` registered with `LoggerProvider` instead.
   */
  applyCustomLogRecordData?: ApplyCustomLogRecordDataFunction;
}
