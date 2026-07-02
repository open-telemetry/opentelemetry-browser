/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Span } from '@opentelemetry/api';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

type XhrCustomAttributeFunction = (
  span: Span,
  xhr: XMLHttpRequest,
  // XXX: fetch instrumentation has a result paranm here (should we align?)
) => void;

// XXX: this configuration is very similar to fetch instrumentation config.
// Given that this instrumentation and fetch are experimental. Could we
// leverage this situation and provide a common configuration Type?
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
}
