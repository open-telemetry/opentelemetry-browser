/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseUrl } from '../url/parseUrl.ts';

export interface PerformanceResourceTimingInfo {
  corsPreFlightRequest?: PerformanceResourceTiming;
  mainRequest?: PerformanceResourceTiming;
}

function sortByFetchStart(
  resources: PerformanceResourceTiming[],
): PerformanceResourceTiming[] {
  return resources.slice().sort((a, b) => a.fetchStart - b.fetchStart);
}

/**
 * Filter resources matching the span URL and initiator type whose timing
 * window overlaps with [spanStartPerfNow, spanEndPerfNow]. All times are in
 * milliseconds relative to performance.timeOrigin (same reference frame as
 * PerformanceResourceTiming timestamps).
 */
function filterResourcesForSpan(
  spanUrl: string,
  spanStartPerfNow: number,
  spanEndPerfNow: number,
  resources: PerformanceResourceTiming[],
  ignoredResources: WeakSet<PerformanceResourceTiming>,
  initiatorType: string,
): PerformanceResourceTiming[] {
  let filtered = resources.filter(
    (r) =>
      r.initiatorType.toLowerCase() === initiatorType &&
      r.name === spanUrl &&
      r.fetchStart >= spanStartPerfNow &&
      r.responseEnd <= spanEndPerfNow,
  );

  if (filtered.length > 0) {
    filtered = filtered.filter((r) => !ignoredResources.has(r));
  }

  return filtered;
}

/**
 * Find the PerformanceResourceTiming entry (and any CORS preflight) that
 * corresponds to the given fetch span.
 *
 * @param spanUrl - Resolved URL of the span.
 * @param spanStartPerfNow - performance.now() at span creation.
 * @param spanEndPerfNow - performance.now() at span end.
 * @param resources - Available resource timing entries.
 * @param ignoredResources - Entries already claimed by previous spans.
 * @param initiatorType - Expected initiatorType (default: 'fetch').
 */
export function getResource(
  spanUrl: string,
  spanStartPerfNow: number,
  spanEndPerfNow: number,
  resources: PerformanceResourceTiming[],
  ignoredResources: WeakSet<PerformanceResourceTiming> = new WeakSet(),
  initiatorType = 'fetch',
): PerformanceResourceTimingInfo {
  const parsedUrl = parseUrl(spanUrl);
  const resolvedUrl = parsedUrl.href;

  const filtered = filterResourcesForSpan(
    resolvedUrl,
    spanStartPerfNow,
    spanEndPerfNow,
    resources,
    ignoredResources,
    initiatorType,
  );

  if (filtered.length === 0) {
    return {
      mainRequest: undefined,
    };
  }

  if (filtered.length === 1) {
    return {
      mainRequest: filtered[0],
    };
  }

  const sorted = sortByFetchStart(filtered);

  if (parsedUrl.origin !== location.origin && sorted.length > 1) {
    // biome-ignore lint/style/noNonNullAssertion: filtered.length > 1 is guaranteed above, so sorted[0] exists.
    const firstResource: PerformanceResourceTiming = sorted[0]!;
    let corsPreFlight: PerformanceResourceTiming | undefined = firstResource;

    // biome-ignore lint/style/noNonNullAssertion: filtered.length > 1 is guaranteed above, so sorted[1] exists.
    let main: PerformanceResourceTiming = sorted[1]!;
    let bestGap: number | undefined;

    /**
     * Find the resource in `sorted` (already sorted by fetchStart) that best
     * corresponds to the main request, skipping the CORS preflight at index 0.
     * All times are in milliseconds relative to performance.timeOrigin.
     */
    for (let i = 1; i < sorted.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: filtered.length > 1 is guaranteed above, so sorted[1] exists.
      const r: PerformanceResourceTiming = sorted[i]!;
      if (r.fetchStart >= firstResource.responseEnd) {
        const gap = spanEndPerfNow - r.responseEnd;
        if (bestGap === undefined || gap < bestGap) {
          bestGap = gap;
          main = r;
        }
      }
    }

    if (main.fetchStart < firstResource.responseEnd) {
      main = firstResource;
      corsPreFlight = undefined;
    }

    return {
      corsPreFlightRequest: corsPreFlight,
      mainRequest: main,
    };
  }

  return {
    mainRequest: filtered[0],
  };
}
