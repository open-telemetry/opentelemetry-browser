/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LogRecord } from '@opentelemetry/api-logs';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

export type AutoCapturedUserAction = 'click';

export type MouseButton = 'left' | 'middle' | 'right';

export type ApplyCustomLogRecordDataFunction = (logRecord: LogRecord) => void;

/**
 * UserActionInstrumentation Configuration
 */
export interface UserActionInstrumentationConfig extends InstrumentationConfig {
  autoCapturedActions?: AutoCapturedUserAction[];
  /** Hook to modify log records before they are emitted. */
  applyCustomLogRecordData?: ApplyCustomLogRecordDataFunction;
}
