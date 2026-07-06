/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Span } from '@opentelemetry/api';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/**
 * Interface used to provide information to finish span on fetch response
 */
export interface FetchResponse {
  status: number;
  statusText?: string;
}

/**
 * Interface used to provide information to finish span on fetch error
 */
export interface FetchError {
  status?: number;
  message: string;
}

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
  /** urls which should include trace headers when origin doesn't match */
  propagateTraceHeaderCorsUrls?: Array<string | RegExp>;
  /**
   * URLs that partially match any regex in ignoreUrls will not be traced.
   * In addition, URLs that are _exact matches_ of strings in ignoreUrls will
   * also not be traced.
   */
  ignoreUrls?: Array<string | RegExp>;
  /** Function for adding custom attributes on the span */
  applyCustomAttributesOnSpan?: FetchCustomAttributeFunction;
  /** Function for adding custom attributes or headers before the request is handled */
  requestHook?: FetchRequestHookFunction;
  /** Measure outgoing request size */
  measureRequestSize?: boolean;
  /** Custom function to sanitize URLs before adding to log records. */
  sanitizeUrl?: (url: string) => string;
}
