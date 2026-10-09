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
   * Sanitizes the URL-bearing fields of a `scripts` entry before they are
   * written: `source_url`, and `invoker` for the entries whose `invoker` is a
   * URL (`classic-script` and `module-script` entries, where it is the invoking
   * script's source URL). For an inline script that URL is the page URL
   * including its query string. Values that are not URLs — a `DOMWindow.onclick`
   * style `invoker`, an empty `source_url` — are written as the browser reports
   * them and are never passed to this function.
   *
   * Defaults to `defaultSanitizeUrl`. Pass `sanitizeUrl: undefined` to emit both
   * fields unsanitized.
   */
  sanitizeUrl?: (url: string) => string;
}
