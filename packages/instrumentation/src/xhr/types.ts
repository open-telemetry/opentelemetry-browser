/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Span } from '@opentelemetry/api';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

type XhrCustomAttributeFunction = (
  span: Span,
  xhr: XMLHttpRequest,
  // TODO: fetch instrumentation has a Response | FetchResult type
  // check if we could do something similar here
) => void;

// TODO: the only differences in config with `fetch` instrumentation are
// - the custom attributes function has a different signature
// - no `requestHook` is in this config although it could be implemented
//   with similar signature `requestHook(span, xhr)
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
  /** Measure outgoing request size */
  measureRequestSize?: boolean;
  /** Custom function to sanitize URLs before adding to log records. */
  sanitizeUrl?: (url: string) => string;
}
