/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export function getNetworkEventsAttributesFromResourceTiming(
  resource: PerformanceResourceTiming,
): Record<string, number> {
  return {
    fetchStart: resource.fetchStart,
    domainLookupStart: resource.domainLookupStart,
    domainLookupEnd: resource.domainLookupEnd,
    connectStart: resource.connectStart,
    secureConnectionStart: resource.secureConnectionStart,
    connectEnd: resource.connectEnd,
    requestStart: resource.requestStart,
    responseStart: resource.responseStart,
    responseEnd: resource.responseEnd,
  };
}
