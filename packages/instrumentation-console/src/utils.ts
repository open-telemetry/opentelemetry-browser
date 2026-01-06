/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpanContext } from '@opentelemetry/api';
import { parseTraceParent, TRACE_PARENT_HEADER } from '@opentelemetry/core';

export function getTraceParent(): SpanContext | null {
  const metaElement = Array.from(document.getElementsByTagName('meta')).find(
    (e) => e.getAttribute('name') === TRACE_PARENT_HEADER,
  );
  return parseTraceParent(metaElement?.content || '');
}
