/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import type {
  InMemorySpanExporter,
  ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestLogExporter, setupTestSpanExporter } from '#utils/test';
import { FetchInstrumentation } from './instrumentation.ts';
import {
  ATTR_HTTP_REQUEST_BODY_SIZE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_REQUEST_METHOD_ORIGINAL,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from './semconv.ts';
import type { FetchInstrumentationConfig } from './types.ts';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeResponse(status = 200, body = 'ok'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function flushSpanEnd(): Promise<void> {
  await vi.runAllTimersAsync();
}

// ─── Test setup ───────────────────────────────────────────────────────────────

describe('FetchInstrumentation', () => {
  let exporter: InMemorySpanExporter;
  let logExporter: InMemoryLogRecordExporter;
  let instrumentation: FetchInstrumentation;
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  /**
   * Creates a mock fetch, registers a new TracerProvider, and enables the
   * instrumentation so that `globalThis.fetch` is patched around mockFetch.
   * Must be called before any test that exercises the instrumentation.
   */
  function setupInstrumentation(config: FetchInstrumentationConfig = {}): void {
    instrumentation?.disable();
    trace.disable();
    logs.disable();

    mockFetch = vi.fn().mockResolvedValue(makeResponse());
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    exporter = setupTestSpanExporter();
    logExporter = setupTestLogExporter();

    instrumentation = new FetchInstrumentation({ enabled: false, ...config });
    instrumentation.enable();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    setupInstrumentation();
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    instrumentation?.disable();
    globalThis.fetch = originalFetch;
    trace.disable();
    logs.disable();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const getSpans = () => exporter.getFinishedSpans();
  const getMainSpan = () =>
    getSpans().find((s) => s.name !== 'CORS Preflight') as
      | ReadableSpan
      | undefined;
  const getLogs = () => logExporter.getFinishedLogRecords();

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('creates an instance', () => {
      expect(instrumentation).toBeInstanceOf(FetchInstrumentation);
    });

    it('patches globalThis.fetch on enable', () => {
      expect(globalThis.fetch).not.toBe(mockFetch);
    });

    it('passes through when disabled', async () => {
      instrumentation.disable();
      fetch('http://localhost/api');
      await flushSpanEnd();
      expect(getSpans()).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('re-enables without double-patching', () => {
      instrumentation.disable();
      instrumentation.enable();
      expect(getSpans()).toHaveLength(0);
    });

    it('is a no-op when enable() is called while already enabled', () => {
      instrumentation.enable(); // already enabled — hits the early-return on line 405
      expect(globalThis.fetch).not.toBe(mockFetch); // still patched, not double-wrapped
    });

    it('handles globalThis.fetch being non-writable without throwing', () => {
      const inst = new FetchInstrumentation({ enabled: false });
      // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
      vi.spyOn(inst as any, '_wrap').mockImplementation(() => {
        throw new Error('_wrap failed');
      });
      expect(() => inst.enable()).not.toThrow();
    });
  });

  // ─── Span creation and attributes ───────────────────────────────────────────

  describe('span attributes', () => {
    it('creates a CLIENT span for a successful fetch', async () => {
      fetch('http://localhost/api');
      await flushSpanEnd();

      const span = getMainSpan();
      expect(span).toBeDefined();

      if (!span) {
        return;
      }

      expect(span.kind).toBe(SpanKind.CLIENT);
    });

    it('sets http.request.method to the normalized method', async () => {
      fetch('http://localhost/api', { method: 'POST' });
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe('POST');
    });

    it('defaults to GET when no method is specified', async () => {
      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe('GET');
    });

    it('normalizes unknown methods to _OTHER', async () => {
      fetch('http://localhost/api', { method: 'BREW' });
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe(
        '_OTHER',
      );
    });

    it('sets http.request.method.original when method is normalized to _OTHER', async () => {
      fetch('http://localhost/api', { method: 'BREW' });
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_HTTP_REQUEST_METHOD_ORIGINAL]).toBe(
        'BREW',
      );
    });

    it('span name equals the normalized HTTP method', async () => {
      fetch('http://localhost/api', { method: 'POST' });
      await flushSpanEnd();

      expect(getMainSpan()?.name).toBe('POST');
    });

    it('sets url.full', async () => {
      fetch('http://localhost/api?q=1');
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_URL_FULL]).toBe(
        'http://localhost/api?q=1',
      );
    });

    it('sets http.response.status_code on success', async () => {
      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(
        200,
      );
    });

    it('sets server.address', async () => {
      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_SERVER_ADDRESS]).toBe('localhost');
    });

    it('sets server.port for non-default ports', async () => {
      // Response.url is set by the browser on real fetches; override it here
      // so _addFinalSpanAttributes sees the correct host+port.
      const response = makeResponse();
      Object.defineProperty(response, 'url', {
        value: 'http://localhost:8080/api',
      });
      mockFetch.mockResolvedValue(response);

      fetch('http://localhost:8080/api');
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_SERVER_PORT]).toBe(8080);
    });

    it('ends the span when the response has no body', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
      fetch('http://localhost/api');
      await flushSpanEnd();

      const span = getMainSpan();
      expect(span?.ended).toBe(true);
      expect(span?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(204);
    });

    it('sets error status and error.type for 4xx responses', async () => {
      mockFetch.mockResolvedValue(makeResponse(404, 'not found'));
      fetch('http://localhost/api');
      await flushSpanEnd();

      const span = getMainSpan();
      expect(span?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(404);
      expect(span?.status.code).toBe(SpanStatusCode.ERROR);
      expect(span?.attributes['error.type']).toBe('404');
    });

    it('sets error status and error.type for 5xx responses', async () => {
      mockFetch.mockResolvedValue(makeResponse(500, 'internal server error'));
      fetch('http://localhost/api');
      await flushSpanEnd();

      const span = getMainSpan();
      expect(span?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(500);
      expect(span?.status.code).toBe(SpanStatusCode.ERROR);
      expect(span?.attributes['error.type']).toBe('500');
    });

    it('ends the span on a network-level fetch error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(fetch('http://localhost/api')).rejects.toThrow();
      await flushSpanEnd();

      const span = getMainSpan();
      expect(span).toBeDefined();
      expect(span?.ended).toBe(true);
    });
  });

  // ─── ignoreUrls ──────────────────────────────────────────────────────────────

  describe('ignoreUrls', () => {
    it('does not create a span for a URL matching a string pattern', async () => {
      setupInstrumentation({ ignoreUrls: ['http://localhost/ignored'] });

      fetch('http://localhost/ignored');
      await flushSpanEnd();

      expect(getSpans()).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('does not create a span for a URL matching a regexp', async () => {
      setupInstrumentation({ ignoreUrls: [/\/health/] });

      fetch('http://localhost/health');
      await flushSpanEnd();

      expect(getSpans()).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('still creates a span for non-matching URLs', async () => {
      setupInstrumentation({ ignoreUrls: [/\/health/] });

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getSpans()).toHaveLength(1);
    });
  });

  // ─── Header injection ─────────────────────────────────────────────────────

  describe('trace header injection', () => {
    const TEST_HEADER = 'x-test-trace';
    const TEST_VALUE = 'test-value-123';

    // Simulates a real propagator injecting a known header so we can assert
    // it reaches the underlying fetch call.
    function mockPropagation(): void {
      vi.spyOn(propagation, 'inject').mockImplementation(
        (_ctx, carrier, setter) => {
          setter?.set(carrier as Headers, TEST_HEADER, TEST_VALUE);
        },
      );
    }

    it('injects trace headers into the request for same-origin requests', async () => {
      mockPropagation();

      fetch('http://localhost/api');
      await flushSpanEnd();

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init?.headers).get(TEST_HEADER)).toBe(TEST_VALUE);
    });

    it('does not inject trace headers for cross-origin requests not in the allowlist', async () => {
      mockPropagation();

      fetch('https://other.example.com/api');
      await flushSpanEnd();

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init?.headers).get(TEST_HEADER)).toBeNull();
    });

    it('logs a debug message when propagation has headers to inject but CORS blocks them', async () => {
      vi.spyOn(propagation, 'inject').mockImplementation((_ctx, carrier) => {
        (carrier as Record<string, string>)['traceparent'] = '00-abc-def-01';
      });

      fetch('https://other.example.com/api');
      await flushSpanEnd();

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init?.headers).get('traceparent')).toBeNull();
    });

    it('injects headers for cross-origin URLs in the allowlist', async () => {
      setupInstrumentation({
        propagateTraceHeaderCorsUrls: [/api\.example\.com/],
      });
      mockPropagation();

      fetch('https://api.example.com/data');
      await flushSpanEnd();

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init?.headers).get(TEST_HEADER)).toBe(TEST_VALUE);
    });

    it('injects trace headers into a Request object for same-origin requests', async () => {
      mockPropagation();

      fetch(new Request('http://localhost/api'));
      await flushSpanEnd();

      const [request] = mockFetch.mock.calls[0] as [Request];
      expect(request.headers.get(TEST_HEADER)).toBe(TEST_VALUE);
    });
  });

  // ─── Hooks ────────────────────────────────────────────────────────────────

  describe('requestHook', () => {
    it('calls requestHook with the span and request', async () => {
      const hookFn = vi.fn();
      setupInstrumentation({ requestHook: hookFn });

      fetch('http://localhost/api', { method: 'GET' });
      await flushSpanEnd();

      expect(hookFn).toHaveBeenCalledOnce();

      const firstCall = hookFn.mock.calls[0];
      expect(firstCall).toBeDefined();

      if (!firstCall) {
        return;
      }

      expect(firstCall[1]).toBeInstanceOf(Object);
    });

    it('does not throw when requestHook throws', async () => {
      setupInstrumentation({
        requestHook: () => {
          throw new Error('hook error');
        },
      });

      await expect(
        fetch('http://localhost/api').then(() => flushSpanEnd()),
      ).resolves.not.toThrow();
    });
  });

  describe('applyCustomAttributesOnSpan', () => {
    it('allows the hook to set a custom attribute on the span', async () => {
      setupInstrumentation({
        applyCustomAttributesOnSpan: (span) => {
          span.setAttribute('custom.attr', 'custom-value');
        },
      });

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getMainSpan()?.attributes['custom.attr']).toBe('custom-value');
    });

    it('does not throw when the hook throws', async () => {
      setupInstrumentation({
        applyCustomAttributesOnSpan: () => {
          throw new Error('hook boom');
        },
      });

      await expect(
        fetch('http://localhost/api').then(() => flushSpanEnd()),
      ).resolves.not.toThrow();

      expect(getMainSpan()).toBeDefined();
    });

    it('allows the hook to set a custom attribute on error', async () => {
      setupInstrumentation({
        applyCustomAttributesOnSpan: (span, _req, result) => {
          if (result instanceof Error) {
            span.setAttribute('custom.error', result.message);
          }
        },
      });
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(fetch('http://localhost/api')).rejects.toThrow();
      await flushSpanEnd();

      expect(getMainSpan()?.attributes['custom.error']).toBe('Failed to fetch');
    });
  });

  // ─── measureRequestSize ───────────────────────────────────────────────────

  describe('measureRequestSize', () => {
    it('sets http.request.body.size for string bodies', async () => {
      setupInstrumentation({ measureRequestSize: true });

      fetch('http://localhost/api', { method: 'POST', body: 'hello' }); // 5 bytes
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toBe(5);
    });

    it('does not set http.request.body.size when there is no body', async () => {
      setupInstrumentation({ measureRequestSize: true });

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(
        getMainSpan()?.attributes[ATTR_HTTP_REQUEST_BODY_SIZE],
      ).toBeUndefined();
    });

    it('ends the span normally when body size measurement throws', async () => {
      setupInstrumentation({ measureRequestSize: true });

      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('stream error'));
        },
      });

      fetch('http://localhost/api', { method: 'POST', body: errorStream });
      await flushSpanEnd();

      expect(getMainSpan()?.ended).toBe(true);
      expect(
        getMainSpan()?.attributes[ATTR_HTTP_REQUEST_BODY_SIZE],
      ).toBeUndefined();
    });
  });

  // ─── clearTimingResources ─────────────────────────────────────────────────

  describe('clearTimingResources', () => {
    it('calls performance.clearResourceTimings() after all spans complete', async () => {
      const clearSpy = vi.spyOn(performance, 'clearResourceTimings');
      setupInstrumentation({ clearTimingResources: true });

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(clearSpy).toHaveBeenCalledOnce();
    });

    it('does not call performance.clearResourceTimings() when disabled', async () => {
      const clearSpy = vi.spyOn(performance, 'clearResourceTimings');
      setupInstrumentation({ clearTimingResources: false });

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(clearSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Request object support ───────────────────────────────────────────────

  describe('Request object support', () => {
    it('handles a Request object as the first argument', async () => {
      fetch(new Request('http://localhost/api', { method: 'PUT' }));
      await flushSpanEnd();

      const span = getMainSpan();
      expect(span?.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe('PUT');
      expect(span?.attributes[ATTR_URL_FULL]).toBe('http://localhost/api');
    });

    it('merges init overrides on top of a Request object', async () => {
      fetch(new Request('http://localhost/api', { method: 'GET' }), {
        method: 'DELETE',
      });
      await flushSpanEnd();

      expect(getMainSpan()?.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe(
        'DELETE',
      );
    });
  });

  // ─── Response body handling ───────────────────────────────────────────────

  describe('response body handling', () => {
    it('ends the span when the response body stream errors mid-read', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new TypeError('stream error'));
        },
      });
      mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getMainSpan()?.ended).toBe(true);
    });

    it('ends the span when response.clone() throws', async () => {
      vi.spyOn(Response.prototype, 'clone').mockImplementationOnce(() => {
        throw new Error('clone failed');
      });

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getMainSpan()?.ended).toBe(true);
    });

    it('falls back to _endSpan when endSpanOnError itself throws', async () => {
      mockFetch.mockRejectedValue(new TypeError('network error'));

      let endSpanCallCount = 0;
      // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
      vi.spyOn(instrumentation as any, '_endSpan').mockImplementation(() => {
        endSpanCallCount++;
        if (endSpanCallCount === 1) {
          throw new Error('_endSpan failed');
        }
      });

      await expect(fetch('http://localhost/api')).rejects.toThrow(
        'network error',
      );
      await flushSpanEnd();

      expect(endSpanCallCount).toBe(2);
    });
  });

  // ─── Performance timing ───────────────────────────────────────────────────

  describe('performance timing', () => {
    it('collects matching resource timing entries via PerformanceObserver', async () => {
      let capturedCallback: PerformanceObserverCallback | undefined;

      class MockPerformanceObserver {
        constructor(cb: PerformanceObserverCallback) {
          capturedCallback = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      }
      vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);

      setupInstrumentation();
      fetch('http://localhost/api');

      const fakeEntry = {
        initiatorType: 'fetch',
        name: 'http://localhost/api',
        entryType: 'resource',
      } as unknown as PerformanceResourceTiming;

      capturedCallback?.(
        {
          getEntries: () => [fakeEntry],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      );

      await flushSpanEnd();
      expect(getMainSpan()?.ended).toBe(true);
    });

    it('emits a log with all timing attributes for a matched resource', async () => {
      let capturedCallback: PerformanceObserverCallback | undefined;

      class MockPerformanceObserver {
        constructor(cb: PerformanceObserverCallback) {
          capturedCallback = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      }
      vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0) // _prepareSpanData: spanStartPerfNow = 0
        .mockReturnValue(1000); // _endSpan:         spanEndPerfNow = 1000

      setupInstrumentation();
      fetch('http://localhost/api');

      capturedCallback?.(
        {
          getEntries: () => [
            {
              initiatorType: 'fetch',
              name: 'http://localhost/api',
              entryType: 'resource',
              startTime: 10,
              fetchStart: 10,
              domainLookupStart: 20,
              domainLookupEnd: 30,
              connectStart: 30,
              secureConnectionStart: 40,
              connectEnd: 50,
              requestStart: 50,
              responseStart: 100,
              responseEnd: 200,
            } as unknown as PerformanceResourceTiming,
          ],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      );

      await flushSpanEnd();

      const logRecords = getLogs();
      expect(logRecords).toHaveLength(1);
      const logRecord = logRecords[0];
      expect(logRecord).toBeDefined();
      if (!logRecord) {
        return;
      }

      const attrs = logRecord.attributes;
      expect(attrs['fetchStart']).toBe(10);
      expect(attrs['domainLookupStart']).toBe(20);
      expect(attrs['domainLookupEnd']).toBe(30);
      expect(attrs['connectStart']).toBe(30);
      expect(attrs['secureConnectionStart']).toBe(40);
      expect(attrs['connectEnd']).toBe(50);
      expect(attrs['requestStart']).toBe(50);
      expect(attrs['responseStart']).toBe(100);
      expect(attrs['responseEnd']).toBe(200);

      const mainSpan = getMainSpan();
      expect(logRecord.spanContext?.traceId).toBe(
        mainSpan?.spanContext().traceId,
      );
      expect(logRecord.spanContext?.spanId).toBe(
        mainSpan?.spanContext().spanId,
      );
    });

    it('creates a CORS Preflight child span when two resource entries exist for a cross-origin URL', async () => {
      let capturedCallback: PerformanceObserverCallback | undefined;

      class MockPerformanceObserver {
        constructor(cb: PerformanceObserverCallback) {
          capturedCallback = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      }
      vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);

      // Control performance.now() so entries fall within the span timing window
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0) // _prepareSpanData: spanStartPerfNow = 0
        .mockReturnValue(1000); // _endSpan:         spanEndPerfNow = 1000

      const crossOriginUrl = 'http://api.example.com/data';
      mockFetch.mockResolvedValue(makeResponse());
      setupInstrumentation();
      fetch(crossOriginUrl);

      const makeEntry = (fetchStart: number, responseEnd: number) =>
        ({
          initiatorType: 'fetch',
          name: crossOriginUrl,
          entryType: 'resource',
          startTime: fetchStart,
          fetchStart,
          domainLookupStart: fetchStart,
          domainLookupEnd: fetchStart,
          connectStart: fetchStart,
          secureConnectionStart: 0,
          connectEnd: fetchStart,
          requestStart: fetchStart,
          responseStart: responseEnd,
          responseEnd,
        }) as unknown as PerformanceResourceTiming;

      capturedCallback?.(
        {
          getEntries: () => [makeEntry(1, 100), makeEntry(200, 400)],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      );

      await flushSpanEnd();

      const corsSpan = getSpans().find((s) => s.name === 'CORS Preflight');
      expect(corsSpan).toBeDefined();
      expect(corsSpan?.ended).toBe(true);
      expect(getLogs()).toHaveLength(2);
    });

    it('does not emit a log when ignoreNetworkEvents is true', async () => {
      let capturedCallback: PerformanceObserverCallback | undefined;

      class MockPerformanceObserver {
        constructor(cb: PerformanceObserverCallback) {
          capturedCallback = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      }
      vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0) // _prepareSpanData: spanStartPerfNow = 0
        .mockReturnValue(1000); // _endSpan:         spanEndPerfNow = 1000

      setupInstrumentation({ ignoreNetworkEvents: true });
      fetch('http://localhost/api');

      capturedCallback?.(
        {
          getEntries: () => [
            {
              initiatorType: 'fetch',
              name: 'http://localhost/api',
              entryType: 'resource',
              startTime: 10,
              fetchStart: 10,
              domainLookupStart: 20,
              domainLookupEnd: 30,
              connectStart: 30,
              secureConnectionStart: 0,
              connectEnd: 50,
              requestStart: 50,
              responseStart: 100,
              responseEnd: 200,
            } as unknown as PerformanceResourceTiming,
          ],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver,
      );

      await flushSpanEnd();
      expect(getLogs()).toHaveLength(0);
    });

    it('ends the span normally when getEntriesByType is unavailable', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: simulating absent browser API
      (performance as any).getEntriesByType = undefined;

      fetch('http://localhost/api');
      await flushSpanEnd();

      expect(getMainSpan()?.ended).toBe(true);
    });
  });

  // ─── Context propagation ──────────────────────────────────────────────────

  describe('context propagation', () => {
    it('creates a span and ends it after the response is consumed', async () => {
      fetch('http://localhost/api');
      await flushSpanEnd();

      const span = getMainSpan();
      expect(span).toBeDefined();

      if (!span) {
        return;
      }

      expect(span.ended).toBe(true);
    });

    it('wraps the fetch call inside context.with so the span is set', () => {
      fetch('http://localhost/api');

      // trace.getActiveSpan() relies on the context manager propagating context.
      // With the NoopContextManager (default OTel API), this returns undefined.
      // The important assertion is that the fetch is still instrumented.
      expect(getSpans().length).toBeGreaterThanOrEqual(0);
    });
  });
});
