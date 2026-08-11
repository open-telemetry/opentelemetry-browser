/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, trace } from '@opentelemetry/api';
import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockServer } from '../../../utils/mock-server.ts';
import {
  COLLECTOR_URL,
  collector,
  LOGS_COLLECTOR_URL,
} from '../../../utils/test-collector.ts';
import type { TestSdkHandle } from '../../../utils/test-otel-setup.ts';
import { testSdkSetup } from '../../../utils/test-otel-setup.ts';

// The SDK exports spans/logs over real HTTP via fetch(). Without excluding
// the collector endpoints, FetchInstrumentation would create a span for each
// export call, which would itself need exporting, recursing forever.
const IGNORE_COLLECTOR_URLS = [COLLECTOR_URL, LOGS_COLLECTOR_URL];

const getUrlForPath = (path: string) => new URL(path, location.href).href;

// This test's own fake application endpoints, unrelated to the OTLP collector.
const fetchHandlers = [
  http.get('/e2e/fetch/get', () => HttpResponse.json({ ok: true })),
  http.get(
    '/e2e/fetch/error',
    () =>
      new HttpResponse(null, {
        status: 500,
        statusText: 'Internal Server Error',
      }),
  ),
  http.get('/e2e/fetch/network-error', () => HttpResponse.error()),
  http.get('/e2e/fetch/abort', () => HttpResponse.json({ ok: true })),
  http.get('/e2e/fetch/child', () => HttpResponse.json({ ok: true })),
  http.get('/e2e/fetch/resource-correlation', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.get('/e2e/fetch/relative-resource-correlation', () =>
    HttpResponse.json({ ok: true }),
  ),
];

describe('FetchInstrumentation', () => {
  let result: TestSdkHandle;

  beforeEach(() => {
    mockServer.use(...fetchHandlers);
  });

  afterEach(async () => {
    await result.shutdown();
  });

  it('creates a span for a fetch request', async () => {
    result = testSdkSetup([
      new FetchInstrumentation({ ignoreUrls: IGNORE_COLLECTOR_URLS }),
    ]);

    const url = getUrlForPath('/e2e/fetch/get');
    await fetch(url);

    await vi.waitFor(
      () => {
        const span = collector
          .getSpans()
          .find(
            (s) =>
              s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === url,
          );
        expect(span).toBeDefined();
        if (!span) {
          throw new Error('Span is undefined');
        }

        const attr = (key: string) =>
          span.attributes.find((a) => a.key === key)?.value;

        expect(attr(ATTR_HTTP_REQUEST_METHOD)).toEqual({
          stringValue: 'GET',
        });
        expect(attr(ATTR_SERVER_ADDRESS)).toEqual({
          stringValue: location.hostname,
        });
        expect(attr(ATTR_SERVER_PORT)).toBeDefined();
        expect(attr(ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({
          intValue: 200,
        });
        expect(span.status.code).toBe(0); // SpanStatusCode.UNSET
      },
      { timeout: 2000 },
    );
  });

  it('sets the span status to error for a non-2xx response', async () => {
    result = testSdkSetup([
      new FetchInstrumentation({ ignoreUrls: IGNORE_COLLECTOR_URLS }),
    ]);

    const url = getUrlForPath('/e2e/fetch/error');
    await fetch(url);

    await vi.waitFor(
      () => {
        const span = collector
          .getSpans()
          .find(
            (s) =>
              s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === url,
          );
        expect(span).toBeDefined();
        if (!span) {
          throw new Error('Span is undefined');
        }

        const attr = (key: string) =>
          span.attributes.find((a) => a.key === key)?.value;

        expect(attr(ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({
          intValue: 500,
        });
        // Per https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status,
        // error.type is the status code as a string when a response was received.
        expect(attr(ATTR_ERROR_TYPE)).toEqual({
          stringValue: '500',
        });
        expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
      },
      { timeout: 2000 },
    );
  });

  it('ends the span with an error status when the request fails with a network error', async () => {
    result = testSdkSetup([
      new FetchInstrumentation({ ignoreUrls: IGNORE_COLLECTOR_URLS }),
    ]);

    const url = getUrlForPath('/e2e/fetch/network-error');
    await expect(fetch(url)).rejects.toThrow();

    await vi.waitFor(
      () => {
        const span = collector
          .getSpans()
          .find(
            (s) =>
              s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === url,
          );
        expect(span).toBeDefined();
        if (!span) {
          throw new Error('Span is undefined');
        }

        const attr = (key: string) =>
          span.attributes.find((a) => a.key === key)?.value;

        // Per https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status,
        // http.response.status_code is only set if a response was actually received,
        // and error.type is the exception's name (a browser fetch() network
        // failure always rejects with a TypeError), not its message.
        expect(attr(ATTR_HTTP_RESPONSE_STATUS_CODE)).toBeUndefined();
        expect(attr(ATTR_ERROR_TYPE)).toEqual({ stringValue: 'TypeError' });
        expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
      },
      { timeout: 2000 },
    );
  });

  it('does not record an error when the request is intentionally aborted', async () => {
    result = testSdkSetup([
      new FetchInstrumentation({ ignoreUrls: IGNORE_COLLECTOR_URLS }),
    ]);

    const url = getUrlForPath('/e2e/fetch/abort');
    const controller = new AbortController();
    const fetchPromise = fetch(url, { signal: controller.signal });
    controller.abort();

    await expect(fetchPromise).rejects.toThrow();

    await vi.waitFor(
      () => {
        const span = collector
          .getSpans()
          .find(
            (s) =>
              s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === url,
          );
        expect(span).toBeDefined();
        if (!span) {
          throw new Error('Span is undefined');
        }

        const attr = (key: string) =>
          span.attributes.find((a) => a.key === key)?.value;

        // Per https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status,
        // an intentional cancellation by the caller is not an error: no
        // status code, no error.type, and the span status stays unset.
        expect(attr(ATTR_HTTP_RESPONSE_STATUS_CODE)).toBeUndefined();
        expect(attr(ATTR_ERROR_TYPE)).toBeUndefined();
        expect(span.status.code).toBe(0); // SpanStatusCode.UNSET
      },
      { timeout: 2000 },
    );
  });

  it('creates the fetch span as a child of the currently active span', async () => {
    result = testSdkSetup([
      new FetchInstrumentation({ ignoreUrls: IGNORE_COLLECTOR_URLS }),
    ]);

    const parentSpan = trace
      .getTracer('fetch-e2e')
      .startSpan('parent-operation');
    const url = getUrlForPath('/e2e/fetch/child');

    await context.with(trace.setSpan(context.active(), parentSpan), () =>
      fetch(url),
    );
    parentSpan.end();

    const { traceId, spanId } = parentSpan.spanContext();

    await vi.waitFor(
      () => {
        const span = collector
          .getSpans()
          .find(
            (s) =>
              s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === url,
          );
        expect(span).toBeDefined();
        if (!span) {
          throw new Error('Span is undefined');
        }

        expect(span.traceId).toBe(traceId);
        expect(span.parentSpanId).toBe(spanId);
      },
      { timeout: 2000 },
    );
  });

  it('stores the network context so a resource timing entry can be correlated with the fetch span', async () => {
    result = testSdkSetup([
      new FetchInstrumentation({ ignoreUrls: IGNORE_COLLECTOR_URLS }),
      new ResourceTimingInstrumentation({
        ignoreUrls: IGNORE_COLLECTOR_URLS,
        // The default PerformanceObserver replays every buffered resource on
        // the page (scripts, HMR, etc.), not just this test's fetch() calls.
        // Scope it down so the assertions below only ever see our own request.
        initiatorTypes: ['fetch'],
      }),
    ]);

    const url = getUrlForPath('/e2e/fetch/resource-correlation');
    await fetch(url);

    const span = await vi.waitFor(
      () => {
        const found = collector
          .getSpans()
          .find(
            (s) =>
              s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === url,
          );
        expect(found).toBeDefined();
        return found;
      },
      { timeout: 2000 },
    );
    if (!span) {
      throw new Error('Span is undefined');
    }

    await vi.waitFor(
      () => {
        const log = collector
          .getLogs()
          .find(
            (l) =>
              l.eventName === 'browser.resource_timing' &&
              l.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === url,
          );
        expect(log).toBeDefined();
        if (!log) {
          throw new Error('Log record is undefined');
        }

        expect(log.traceId).toBe(span.traceId);
        expect(log.spanId).toBe(span.spanId);
      },
      { timeout: 5000 },
    );
  });

  it('correlates the resource timing entry when fetch is called with a relative URL', async () => {
    result = testSdkSetup([
      new FetchInstrumentation({ ignoreUrls: IGNORE_COLLECTOR_URLS }),
      new ResourceTimingInstrumentation({
        ignoreUrls: IGNORE_COLLECTOR_URLS,
        initiatorTypes: ['fetch'],
      }),
    ]);

    // Call fetch() with a relative URL. The browser always reports resource
    // timing entries with the resolved absolute URL, so this only correlates
    // if FetchInstrumentation registers the network context under the same
    // absolute URL it resolves internally, rather than the raw relative input.
    const relativeUrl = '/e2e/fetch/relative-resource-correlation';
    const absoluteUrl = getUrlForPath(relativeUrl);
    await fetch(relativeUrl);

    const span = await vi.waitFor(
      () => {
        const found = collector
          .getSpans()
          .find(
            (s) =>
              s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === absoluteUrl,
          );
        expect(found).toBeDefined();
        return found;
      },
      { timeout: 2000 },
    );
    if (!span) {
      throw new Error('Span is undefined');
    }

    await vi.waitFor(
      () => {
        const log = collector
          .getLogs()
          .find(
            (l) =>
              l.eventName === 'browser.resource_timing' &&
              l.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
                .stringValue === absoluteUrl,
          );
        expect(log).toBeDefined();
        if (!log) {
          throw new Error('Log record is undefined');
        }

        expect(log.traceId).toBe(span.traceId);
        expect(log.spanId).toBe(span.spanId);
      },
      { timeout: 5000 },
    );
  });
});
