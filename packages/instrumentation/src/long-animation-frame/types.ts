/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A script timing entry reported by the Long Animation Frames API.
 *
 * Named after the entry rather than after the spec's
 * `PerformanceScriptTiming` interface: the DOM lib declares a global with that
 * name once the API ships, and an exported type that shadows a global is
 * confusing to import.
 * @see https://w3c.github.io/long-animation-frames/#sec-performance-script-timing
 */
export interface LongAnimationFrameScript extends PerformanceEntry {
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

/**
 * A long-animation-frame performance entry, currently missing from TypeScript's
 * DOM lib.
 *
 * `renderStart`, `styleAndLayoutStart` and `firstUIEventTimestamp` are `0` when
 * the frame has no such value — no rendering cycle, no UI event — which is why
 * they are typed as always-present numbers rather than optional fields.
 * @see https://w3c.github.io/long-animation-frames/#sec-performance-long-animation-frame-timing
 */
export interface LongAnimationFrameEntry extends PerformanceEntry {
  renderStart: DOMHighResTimeStamp;
  styleAndLayoutStart: DOMHighResTimeStamp;
  blockingDuration: DOMHighResTimeStamp;
  firstUIEventTimestamp: DOMHighResTimeStamp;
  scripts: LongAnimationFrameScript[];
}

/**
 * LongAnimationFrameInstrumentation Configuration
 */
export interface LongAnimationFrameInstrumentationConfig {
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
