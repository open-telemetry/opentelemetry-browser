/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Span } from '@opentelemetry/api';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

export type XhrCustomAttributeFunction = (
  span: Span,
  xhr: XMLHttpRequest,
) => void;

export type XhrRequestHookFunction = (span: Span, xhr: XMLHttpRequest) => void;

export interface XhrInstrumentationConfig extends InstrumentationConfig {
  /** URLs which should include trace headers when origin doesn't match */
  propagateTraceHeaderCorsUrls?: Array<string | RegExp>;
  /**
   * URLs that partially match any regex in ignoreUrls will not be traced.
   * In addition, URLs that are _exact matches_ of strings in ignoreUrls will
   * also not be traced.
   */
  ignoreUrls?: Array<string | RegExp>;
  /** Function for adding custom attributes on the span */
  applyCustomAttributesOnSpan?: XhrCustomAttributeFunction;
  /** Function for adding custom attributes or headers before the request is handled */
  requestHook?: XhrRequestHookFunction;
  /** Measure outgoing request size */
  measureRequestSize?: boolean;
  /** Custom function to sanitize URLs before adding to log records. */
  sanitizeUrl?: (url: string) => string;
}
