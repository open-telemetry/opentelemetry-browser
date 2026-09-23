/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Throws if `PerformanceObserver` is missing. Call it from `_init()`, so an
 * unsupported browser warns once and the instrumentation stays off. `typeof`
 * checks at call time, so it sees late polyfills and never throws a
 * ReferenceError outside a browser.
 */
export function assertPerformanceObserver(): void {
  if (typeof PerformanceObserver === 'undefined') {
    throw new Error(
      'PerformanceObserver is not available. This instrumentation needs a browser that supports it.',
    );
  }
}
