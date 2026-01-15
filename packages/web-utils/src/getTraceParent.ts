/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpanContext } from '@opentelemetry/api';
import { parseTraceParent, TRACE_PARENT_HEADER } from '@opentelemetry/core';

/**
 * Gets the raw traceparent string from the meta tag in the document.
 * This is useful for use with propagation.extract() to create a proper context.
 *
 * @returns The raw traceparent string if a meta tag is found, empty string otherwise
 */
export function getTraceParentString(): string {
  const metaElement = document.querySelector<HTMLMetaElement>(
    `meta[name="${TRACE_PARENT_HEADER}"]`,
  );
  return metaElement?.content ?? '';
}

/**
 * Extracts the traceparent from a meta tag in the document and parses it.
 * This is useful for correlating browser logs/spans with server-side traces
 * when the server injects the traceparent into the HTML.
 *
 * @returns The parsed SpanContext if a valid traceparent meta tag is found, null otherwise
 */
export function getTraceParent(): SpanContext | null {
  return parseTraceParent(getTraceParentString());
}
