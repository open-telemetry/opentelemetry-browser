/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpanContext } from '@opentelemetry/api';
import { parseTraceParent, TRACE_PARENT_HEADER } from '@opentelemetry/core';

export function getTraceParent(): SpanContext | null {
  const metaElement = document.querySelector<HTMLMetaElement>(
    `meta[name="${TRACE_PARENT_HEADER}"]`,
  );
  return parseTraceParent(metaElement?.content ?? '');
}
