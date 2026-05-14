/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';

type ResourceWithContext = Pick<
  PerformanceResourceTiming,
  'name' | 'fetchStart' | 'responseEnd'
>;

const resourceContextMap = new Map<ResourceWithContext, Context>();

/**
 * Saves a context for the given resource info for a period of time (default to 1sec)
 */
export function setContextForResource(
  res: ResourceWithContext,
  ctx: Context,
  ttl: number = 1000,
) {
  if (resourceContextMap.has(res)) {
    // TODO: log/debug? override?
  } else {
    resourceContextMap.set(res, ctx);
    setTimeout(() => resourceContextMap.delete(res), ttl);
  }
}

/**
 * Returns a context for the a matching resource if it was saved previously within the TTL.
 * Undefined otherwise
 */
export function getContextForResource(
  res: ResourceWithContext,
): Context | undefined {
  let ctx: Context | undefined;
  for (const [r, c] of resourceContextMap) {
    if (
      r.name === res.name &&
      res.fetchStart >= r.fetchStart &&
      res.responseEnd <= r.responseEnd
    ) {
      // TODO: is it possible that more than one matches?
      ctx = c;
    }

    // Cleanup the resource if too old
    if (performance.now() - r.responseEnd > 3000) {
      resourceContextMap.delete(r);
    }
  }
  return ctx;
}
