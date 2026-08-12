/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/** A task-attribution entry reported by the Long Tasks API. */
export interface TaskAttributionTiming extends PerformanceEntry {
  containerType: string;
  containerSrc: string;
  containerId: string;
  containerName: string;
}

/** A long-task performance entry, currently missing from TypeScript DOM types. */
export interface PerformanceLongTaskTiming extends PerformanceEntry {
  attribution: TaskAttributionTiming[];
}

export type ApplyCustomLogRecordDataFunction = (logRecord: LogRecord) => void;

/** LongTaskInstrumentation configuration. */
export interface LongTaskInstrumentationConfig extends InstrumentationConfig {
  /** Hook to modify long-task log records before they are emitted. */
  applyCustomLogRecordData?: ApplyCustomLogRecordDataFunction;
}
