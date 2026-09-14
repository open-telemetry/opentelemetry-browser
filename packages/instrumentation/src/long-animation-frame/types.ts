/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/** A script timing entry reported by the Long Animation Frames API. */
export interface PerformanceScriptTiming extends PerformanceEntry {
  invokerType: string;
  invoker: string;
  executionStart: DOMHighResTimeStamp;
  sourceURL: string;
  sourceFunctionName: string;
  sourceCharPosition: number;
  pauseDuration: DOMHighResTimeStamp;
  forcedStyleAndLayoutDuration: DOMHighResTimeStamp;
  windowAttribution: string;
  window: Window | null;
}

/** A long-animation-frame performance entry, currently missing from TypeScript DOM types. */
export interface PerformanceLongAnimationFrameTiming extends PerformanceEntry {
  renderStart: DOMHighResTimeStamp;
  styleAndLayoutStart: DOMHighResTimeStamp;
  blockingDuration: DOMHighResTimeStamp;
  firstUIEventTimestamp: DOMHighResTimeStamp;
  scripts: PerformanceScriptTiming[];
}

export type ApplyCustomLogRecordDataFunction = (logRecord: LogRecord) => void;

/** LongAnimationFrameInstrumentation configuration. */
export interface LongAnimationFrameInstrumentationConfig
  extends InstrumentationConfig {
  /** Hook to modify long-animation-frame log records before they are emitted. */
  applyCustomLogRecordData?: ApplyCustomLogRecordDataFunction;
}
