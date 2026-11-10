/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';
import { createContextKey } from '@opentelemetry/api';

// Same key as `suppressTracing()` in `@opentelemetry/core`. `createContextKey`
// returns `Symbol.for(description)`, so this matches any copy of core without
// depending on it.
const SUPPRESS_TRACING_KEY = createContextKey(
  'OpenTelemetry SDK Context Key SUPPRESS_TRACING',
);

/** Whether `ctx` was marked by `suppressTracing()` from `@opentelemetry/core`. */
export function isTracingSuppressed(ctx: Context): boolean {
  return ctx.getValue(SUPPRESS_TRACING_KEY) === true;
}
