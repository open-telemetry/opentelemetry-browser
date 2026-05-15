/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getNetworkEventsAttributesFromResourceTiming } from './getNetworkEventsAttributesFromResourceTiming.ts';

const makeEntry = (
  overrides: Partial<PerformanceResourceTiming>,
): PerformanceResourceTiming =>
  ({
    fetchStart: 0,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    secureConnectionStart: 0,
    connectEnd: 0,
    requestStart: 0,
    responseStart: 0,
    responseEnd: 0,
    ...overrides,
  }) as unknown as PerformanceResourceTiming;

describe('getNetworkEventsAttributesFromResourceTiming', () => {
  it('returns all nine timing fields from the entry', () => {
    const entry = makeEntry({
      fetchStart: 10,
      domainLookupStart: 20,
      domainLookupEnd: 30,
      connectStart: 30,
      secureConnectionStart: 40,
      connectEnd: 50,
      requestStart: 50,
      responseStart: 100,
      responseEnd: 200,
      name: 'I should be ignored',
    });

    const attrs = getNetworkEventsAttributesFromResourceTiming(entry);

    expect(attrs).toEqual({
      fetchStart: 10,
      domainLookupStart: 20,
      domainLookupEnd: 30,
      connectStart: 30,
      secureConnectionStart: 40,
      connectEnd: 50,
      requestStart: 50,
      responseStart: 100,
      responseEnd: 200,
    });
  });
});
