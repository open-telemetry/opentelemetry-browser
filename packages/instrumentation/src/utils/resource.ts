/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';

// type ResourceWithContext = Pick<
//   PerformanceResourceTiming,
//   'name' | 'fetchStart' | 'responseEnd'
// >;

/**
 * In some situations a resource is fetched within the context
 * of an active Span like document load or a fetch/XHR request.
 * Since the resource timing API is executed in a differnet context
 * and browsers do not have a AsyncContext propagation (yet) we will
 * let the instrumentaiton to stash the context so it can be queried
 * later to provide the right context to the log record
 */
interface ResourceWithContext {
  url: string;
  startTime: number; // relative to performance.timeOrigin
  endTime: number; // relative to performance.timeOrigin
}

/**
 * Contains the resources and their context
 */
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
 * Returns the context of the 1st resource that satisfies the predicate function
 */
export function findContextForResource(
  predicate: (r: ResourceWithContext) => boolean,
): Context | undefined {
  for (const [res, ctx] of resourceContextMap) {
    if (predicate(res)) {
      return ctx;
    }
  }
}
