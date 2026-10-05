/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

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

/**
 * LongAnimationFrameInstrumentation Configuration
 */
export interface LongAnimationFrameInstrumentationConfig
  extends InstrumentationConfig {
  /**
   * Custom function to sanitize URLs before they are written to the `scripts`
   * array. `invoker` and `source_url` are emitted as the browser reports them,
   * and for an inline script or a listener defined on the page both are the
   * page URL including its query string.
   */
  sanitizeUrl?: (url: string) => string;
}
