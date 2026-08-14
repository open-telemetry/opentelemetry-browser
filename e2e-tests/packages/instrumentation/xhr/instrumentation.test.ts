/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, trace } from '@opentelemetry/api';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';
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
import { collector } from '../../../utils/test-collector.ts';
import type { TestSdkHandle } from '../../../utils/test-otel-setup.ts';
import { testSdkSetup } from '../../../utils/test-otel-setup.ts';

const getUrlForPath = (path: string) => new URL(path, location.href).href;

const getSpanByUrl = (url: string) => {
  const span = collector
    .getSpans()
    .find(
      (s) =>
        s.attributes.find((a) => a.key === ATTR_URL_FULL)?.value.stringValue ===
        url,
    );
  expect(span).toBeDefined();

  // biome-ignore lint/style/noNonNullAssertion: expect(...).toBeDefined() above throws if undefined
  return span!;
};

const getResourceTimingLogByUrl = (url: string) => {
  const log = collector
    .getLogs()
    .find(
      (l) =>
        l.eventName === 'browser.resource_timing' &&
        l.attributes.find((a) => a.key === ATTR_URL_FULL)?.value.stringValue ===
          url,
    );
  expect(log).toBeDefined();

  // biome-ignore lint/style/noNonNullAssertion: expect(...).toBeDefined() above throws if undefined
  return log!;
};

const xhrRequest = async (url: string) => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  return new Promise((resolve, reject) => {
    // xhr.onload = resolve;
    // xhr.onerror = reject;
    // xhr.ontimeout = reject;
    xhr.onloadend = resolve;
    xhr.send();
  });
};

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

describe('XhrInstrumentation', () => {
  let result: TestSdkHandle;

  beforeEach(() => {
    mockServer.use(...fetchHandlers);
  });

  afterEach(async () => {
    await result.shutdown();
  });

  it('creates a span for a XmlHttpRequest', async () => {
    result = testSdkSetup([new XhrInstrumentation()]);

    const url = getUrlForPath('/e2e/fetch/get');
    await xhrRequest(url);

    const span = await vi.waitFor(() => getSpanByUrl(url), { timeout: 2000 });

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
  });

  it('sets the span status to error for a non-2xx response', async () => {
    result = testSdkSetup([new XhrInstrumentation()]);

    const url = getUrlForPath('/e2e/fetch/error');
    await xhrRequest(url);

    const span = await vi.waitFor(() => getSpanByUrl(url), { timeout: 2000 });

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
  });

  it('ends the span with an error status when the request fails with a network error', async () => {
    result = testSdkSetup([new XhrInstrumentation()]);

    const url = getUrlForPath('/e2e/fetch/network-error');
    await xhrRequest(url);

    const span = await vi.waitFor(() => getSpanByUrl(url), { timeout: 2000 });

    const attr = (key: string) =>
      span.attributes.find((a) => a.key === key)?.value;

    // Per https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status,
    // http.response.status_code is only set if a response was actually received,
    // and error.type is the exception's name (a browser fetch() network
    // failure always rejects with a TypeError), not its message.
    expect(attr(ATTR_HTTP_RESPONSE_STATUS_CODE)).toBeUndefined();
    expect(attr(ATTR_ERROR_TYPE)).toEqual({ stringValue: 'Error' });
    expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
  });

  it('does not record an error when the request is intentionally aborted', async () => {
    result = testSdkSetup([new XhrInstrumentation()]);

    const url = getUrlForPath('/e2e/fetch/abort');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.send();
    xhr.abort();

    const span = await vi.waitFor(() => getSpanByUrl(url), { timeout: 2000 });

    const attr = (key: string) =>
      span.attributes.find((a) => a.key === key)?.value;

    // Per https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status,
    // an intentional cancellation by the caller is not an error: no
    // status code, no error.type, and the span status stays unset.
    expect(attr(ATTR_HTTP_RESPONSE_STATUS_CODE)).toBeUndefined();
    expect(attr(ATTR_ERROR_TYPE)).toBeUndefined();
    expect(span.status.code).toBe(0); // SpanStatusCode.UNSET
  });

  it('creates the XHR span as a child of the currently active span', async () => {
    result = testSdkSetup([new XhrInstrumentation()]);

    const parentSpan = trace
      .getTracer('fetch-e2e')
      .startSpan('parent-operation');
    const url = getUrlForPath('/e2e/fetch/child');

    await context.with(trace.setSpan(context.active(), parentSpan), () =>
      xhrRequest(url),
    );
    parentSpan.end();

    const { traceId, spanId } = parentSpan.spanContext();

    const span = await vi.waitFor(() => getSpanByUrl(url), { timeout: 2000 });

    expect(span.traceId).toBe(traceId);
    expect(span.parentSpanId).toBe(spanId);
  });

  it('stores the network context so a resource timing entry can be correlated with the XHR span', async () => {
    result = testSdkSetup([
      new XhrInstrumentation(),
      new ResourceTimingInstrumentation({
        // The default PerformanceObserver replays every buffered resource on
        // the page (scripts, HMR, etc.), not just this test's XHRs.
        // Scope it down so the assertions below only ever see our own request.
        initiatorTypes: ['xmlhttprequest'],
      }),
    ]);

    const url = getUrlForPath('/e2e/fetch/resource-correlation');
    await xhrRequest(url);

    const span = await vi.waitFor(() => getSpanByUrl(url), { timeout: 2000 });
    const log = await vi.waitFor(() => getResourceTimingLogByUrl(url), {
      timeout: 5000,
    });

    expect(log.traceId).toBe(span.traceId);
    expect(log.spanId).toBe(span.spanId);
  });

  it.only('correlates the resource timing entry when XHR is called with a relative URL', async () => {
    result = testSdkSetup([
      new XhrInstrumentation(),
      new ResourceTimingInstrumentation({
        initiatorTypes: ['xmlhttprequest'],
      }),
    ]);

    // Call fetch() with a relative URL. The browser always reports resource
    // timing entries with the resolved absolute URL, so this only correlates
    // if FetchInstrumentation registers the network context under the same
    // absolute URL it resolves internally, rather than the raw relative input.
    const relativeUrl = '/e2e/fetch/relative-resource-correlation';
    const absoluteUrl = getUrlForPath(relativeUrl);
    await xhrRequest(relativeUrl);

    const span = await vi.waitFor(() => getSpanByUrl(absoluteUrl), {
      timeout: 2000,
    });
    const log = await vi.waitFor(() => getResourceTimingLogByUrl(absoluteUrl), {
      timeout: 5000,
    });

    expect(log.traceId).toBe(span.traceId);
    expect(log.spanId).toBe(span.spanId);
  });
});
