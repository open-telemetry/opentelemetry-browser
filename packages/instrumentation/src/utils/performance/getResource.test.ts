/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getResource } from './getResource.ts';

function makeEntry(
  overrides: Partial<Record<string, unknown>> = {},
): PerformanceResourceTiming {
  return {
    initiatorType: 'fetch',
    name: 'http://localhost/api',
    fetchStart: 100,
    responseEnd: 200,
    startTime: 100,
    duration: 100,
    entryType: 'resource',
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    secureConnectionStart: 0,
    connectEnd: 0,
    requestStart: 0,
    responseStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    workerStart: 0,
    nextHopProtocol: '',
    toJSON: () => ({}),
    ...overrides,
  } as unknown as PerformanceResourceTiming;
}

describe('getResource', () => {
  it('returns undefined mainRequest when no resources match', () => {
    const result = getResource('http://localhost/api', 50, 300, []);
    expect(result).toEqual({ mainRequest: undefined });
  });

  it('returns the single matching resource as mainRequest', () => {
    const entry = makeEntry();
    const result = getResource('http://localhost/api', 50, 300, [entry]);
    expect(result.mainRequest).toBe(entry);
    expect(result.corsPreFlightRequest).toBeUndefined();
  });

  it('excludes resources outside the span time window', () => {
    const tooEarly = makeEntry({ fetchStart: 10, responseEnd: 40 });
    const tooLate = makeEntry({ fetchStart: 400, responseEnd: 500 });
    const result = getResource('http://localhost/api', 50, 300, [
      tooEarly,
      tooLate,
    ]);
    expect(result.mainRequest).toBeUndefined();
  });

  it('excludes resources already in ignoredResources', () => {
    const entry = makeEntry();
    const ignored = new WeakSet([entry]);
    const result = getResource(
      'http://localhost/api',
      50,
      300,
      [entry],
      ignored,
    );
    expect(result.mainRequest).toBeUndefined();
  });

  it('excludes resources with the wrong initiatorType', () => {
    const entry = makeEntry({ initiatorType: 'xmlhttprequest' });
    const result = getResource('http://localhost/api', 50, 300, [entry]);
    expect(result.mainRequest).toBeUndefined();
  });

  it('uses a custom initiatorType when provided', () => {
    const entry = makeEntry({ initiatorType: 'xmlhttprequest' });
    const result = getResource(
      'http://localhost/api',
      50,
      300,
      [entry],
      new WeakSet(),
      'xmlhttprequest',
    );
    expect(result.mainRequest).toBe(entry);
  });

  it('resolves relative URLs via document.baseURI', () => {
    const entry = makeEntry({ name: 'http://localhost/api' });
    // '/api' resolves to 'http://localhost/api' with jsdom url: 'http://localhost/'
    const result = getResource('/api', 50, 300, [entry]);
    expect(result.mainRequest).toBe(entry);
  });

  it('picks the best of multiple same-origin matches', () => {
    const first = makeEntry({ fetchStart: 100, responseEnd: 150 });
    const second = makeEntry({ fetchStart: 110, responseEnd: 200 });
    // With same origin, just returns filtered[0] (no CORS logic)
    const result = getResource('http://localhost/api', 50, 300, [
      first,
      second,
    ]);
    expect(result.mainRequest).toBe(first);
    expect(result.corsPreFlightRequest).toBeUndefined();
  });

  it('detects CORS preflight for cross-origin URLs', () => {
    const preflight = makeEntry({
      name: 'http://api.example.com/data',
      fetchStart: 100,
      responseEnd: 130,
    });
    const main = makeEntry({
      name: 'http://api.example.com/data',
      fetchStart: 140,
      responseEnd: 250,
    });
    const result = getResource('http://api.example.com/data', 50, 300, [
      preflight,
      main,
    ]);
    expect(result.corsPreFlightRequest).toBe(preflight);
    expect(result.mainRequest).toBe(main);
  });
});
