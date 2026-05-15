/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Span } from '@opentelemetry/api';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

type PropagateTraceHeaderCorsUrl = string | RegExp;

export type PropagateTraceHeaderCorsUrls =
  | PropagateTraceHeaderCorsUrl
  | PropagateTraceHeaderCorsUrl[];

export type FetchCustomAttributeFunction = (
  span: Span,
  request: Request | RequestInit,
  result: Response | FetchError,
) => void;

export type FetchRequestHookFunction = (
  span: Span,
  request: Request | RequestInit,
) => void;

export interface FetchInstrumentationConfig extends InstrumentationConfig {
  /** Regularly clear timing resources to avoid the browser limit (chrome 250, safari 150). */
  clearTimingResources?: boolean;
  /** URLs that should receive trace headers even when origin doesn't match. */
  propagateTraceHeaderCorsUrls?: PropagateTraceHeaderCorsUrls;
  /** URLs matching any entry will not be traced. */
  ignoreUrls?: Array<string | RegExp>;
  /** Called to add custom attributes on the span after the fetch completes. */
  applyCustomAttributesOnSpan?: FetchCustomAttributeFunction;
  /** Called to add custom attributes or headers before the request is sent. */
  requestHook?: FetchRequestHookFunction;
  /** Skip adding network timing as span events. */
  ignoreNetworkEvents?: boolean;
  /** Measure outgoing request body size. */
  measureRequestSize?: boolean;
}

/** Internal type for passing data between span creation and completion. */
export interface SpanData {
  entries: PerformanceResourceTiming[];
  observer?: PerformanceObserver;
  spanUrl: string;
  /** performance.now() timestamp at span creation — same reference frame as PerformanceResourceTiming. */
  startPerfNow: number;
}

/** Internal representation of a fetch error. */
export interface FetchError {
  status?: number;
  message: string;
}

/** Internal representation of a completed fetch response. */
export interface FetchResponse {
  status: number;
  statusText?: string;
  url: string;
}
