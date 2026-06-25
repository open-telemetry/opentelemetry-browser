/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, Span } from '@opentelemetry/api';
import { ROOT_CONTEXT, trace } from '@opentelemetry/api';

interface SpanRecord {
  ctx: Context;
  startPerfNow: number;
  endPerfNow: number;
}

/**
 * Stores OTel span contexts keyed by URL and timing window, so that
 * resource timing entries produced by network requests can be correlated
 * with the corresponding span.
 *
 * The network instrumentation (fetch, XHR) calls `register()` when a span
 * ends; the resource timing instrumentation calls `getContext()` when
 * emitting a log for a resource timing entry.
 */
export class NetworkContextManager {
  private _records = new Map<string, SpanRecord[]>();

  /**
   * Register a completed network span. `startPerfNow` and `endPerfNow`
   * must be `performance.now()` values captured at span start and end
   * respectively — the same reference frame as `PerformanceResourceTiming`
   * timestamps.
   */
  register(
    span: Span,
    url: string,
    startPerfNow: number,
    endPerfNow: number,
  ): void {
    const ctx = trace.setSpan(ROOT_CONTEXT, span);
    const list = this._records.get(url) ?? [];
    list.push({ ctx, startPerfNow, endPerfNow });
    this._records.set(url, list);
  }

  /**
   * Return the OTel context for the span whose timing window contains the
   * given resource timing entry, or `undefined` if no match is found.
   */
  getContext(entry: PerformanceResourceTiming): Context | undefined {
    const list = this._records.get(entry.name);
    return list?.find(
      (r) =>
        entry.fetchStart >= r.startPerfNow && entry.responseEnd <= r.endPerfNow,
    )?.ctx;
  }
}

let _instance: NetworkContextManager | undefined;

/**
 * Returns the singleton `NetworkContextManager` instance, creating it on
 * first call.
 */
export function getNetworkContextManager(): NetworkContextManager {
  if (!_instance) {
    _instance = new NetworkContextManager();
  }

  return _instance;
}
