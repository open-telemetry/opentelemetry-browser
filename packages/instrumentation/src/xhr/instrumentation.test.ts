/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { propagation, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { hrTime, hrTimeToMilliseconds } from '@opentelemetry/core';
import { isWrapped } from '@opentelemetry/instrumentation';
import {
  B3InjectEncoding,
  B3Propagator,
  X_B3_SAMPLED,
  X_B3_SPAN_ID,
  X_B3_TRACE_ID,
} from '@opentelemetry/propagator-b3';
import type {
  InMemorySpanExporter,
  ReadableSpan,
} from '@opentelemetry/sdk-trace';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';
import { HttpResponse, http } from 'msw';
import { setupWorker } from 'msw/browser';
import type { Mock } from 'vitest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { defaultSanitizeUrl, getNetworkContextRegistry } from '#utils';
import { setupTestSpanExporter } from '#utils/test';
import { XhrInstrumentation } from './instrumentation.ts';
import { ATTR_HTTP_REQUEST_BODY_SIZE } from './semconv.ts';

const VITEST_SERVER_URL = new URL(location.href);
const VITEST_SERVER_NAME = VITEST_SERVER_URL.hostname;
const VITEST_SERVER_PORT = parseInt(VITEST_SERVER_URL.port, 10);
const networkContextRegistry = getNetworkContextRegistry();
const originalOpenFunction = XMLHttpRequest.prototype.open;
const originalSendFunction = XMLHttpRequest.prototype.send;

export const handlers = [
  http.get('/api/get', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.post('/api/post', () => {
    return HttpResponse.json({ ok: true });
  }),
  // MSW does not have a specific handler for query
  http.all('/api/query', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.get('/api/error', () => {
    return new HttpResponse(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }),
  http.get('/api/network-error', () => {
    return HttpResponse.error();
  }),
  http.get('/null-body-204', () => {
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/null-body-205', () => {
    return new HttpResponse(null, { status: 205 });
  }),
  http.get('/null-body-304', () => {
    return new HttpResponse(null, { status: 304 });
  }),
  http.get('/api/echo-headers.json', ({ request }) => {
    return HttpResponse.json({
      request: {
        headers: Object.fromEntries(request.headers),
      },
    });
  }),
  http.get('/api/stream', () => {
    let timer: number | undefined;
    let pushes = 0;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Continuously push data to simulate a long connection
        timer = setInterval(() => {
          if (pushes >= 25) {
            clearInterval(timer);
            controller.close();
            return;
          }
          pushes += 1;
          controller.enqueue(encoder.encode(`data: ${pushes}\n`));
        }, 50);
      },
    });

    const response = new HttpResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

    return response;
  }),
  http.get('http://example.com/api/status.json', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.get('http://example.com/api/echo-headers.json', ({ request }) => {
    return HttpResponse.json({
      request: {
        headers: Object.fromEntries(request.headers),
      },
    });
  }),
];

const doXhrRequest = (options: {
  method: string;
  url: string | URL;
  headers?: Record<string, string>;
  body?: Document | XMLHttpRequestBodyInit | null;
}): Promise<{ request: XMLHttpRequest; json: () => Promise<unknown> }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method, options.url);
    if (options.headers) {
      for (const entry of Object.entries(options.headers)) {
        xhr.setRequestHeader(entry[0], entry[1]);
      }
    }

    // Response like object to be returned
    const response = {
      request: xhr,
      json() {
        return Promise.resolve(JSON.parse(xhr.responseText));
      },
    };

    xhr.send(options.body);
    xhr.onerror = reject;
    xhr.onload = () => resolve(response);
  });
};

describe('XhrInstrumentation', () => {
  let inMemoryExporter: InMemorySpanExporter;
  let instrumentation: XhrInstrumentation;

  const msWorker = setupWorker(...handlers);

  beforeAll(async () => {
    await msWorker.start();
    inMemoryExporter = setupTestSpanExporter();
  });

  beforeEach(() => {
    vi.spyOn(networkContextRegistry, 'register');
  });

  afterEach(() => {
    inMemoryExporter.reset();
    msWorker.resetHandlers();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    msWorker.stop();
  });

  const getUrlForPath = (path: string) => {
    const url = new URL(path, location.href);
    return url.href;
  };

  const scopeName = '@opentelemetry/browser-instrumentation/xhr';
  const getXhrSpans = () =>
    inMemoryExporter
      .getFinishedSpans()
      .filter((span) => span.instrumentationScope.name === scopeName);

  const waitForSpan = async (
    url: string,
    timeoutMs = 1000,
  ): Promise<ReturnType<typeof getXhrSpans>[0]> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const spans = getXhrSpans();
      const found = spans.find(
        (span) => span.attributes[ATTR_URL_FULL] === url,
      );
      if (found) {
        return found;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
      `Span with URL "${url}" not captured within ${timeoutMs}ms`,
    );
  };

  const assertResourceRegistered = (options: {
    span: ReadableSpan;
    url: string;
    startTime: number;
    endTime: number;
  }) => {
    // Context has been stashed for the resource
    const registerMock = networkContextRegistry.register as unknown as Mock<
      typeof networkContextRegistry.register
    >;
    const registeredSpan = registerMock.mock.lastCall?.[0];
    const registerData = registerMock.mock.lastCall?.[1];

    expect(registerMock).toHaveBeenCalledOnce();
    expect(registerData?.key).toEqual(options.url);
    expect(registerData?.startPerfNow).toBeGreaterThanOrEqual(
      options.startTime,
    );
    expect(registerData?.endPerfNow).toBeLessThanOrEqual(options.endTime);
    expect(registeredSpan).toBeDefined();
    expect(registeredSpan?.spanContext()).toEqual(options.span.spanContext());
  };

  type PropagationResponse = { request: { headers: Record<string, string> } };
  const assertPropagationHeaders = async (
    response: { json: () => Promise<unknown> },
    span?: ReadableSpan,
  ): Promise<Record<string, string>> => {
    const { request } = (await response.json()) as PropagationResponse;

    if (span) {
      expect(request.headers[X_B3_TRACE_ID]).toEqual(
        span.spanContext().traceId,
      );
      expect(request.headers[X_B3_SPAN_ID]).toEqual(span.spanContext().spanId);
      expect(request.headers[X_B3_SAMPLED]).toEqual(
        String(span.spanContext().traceFlags),
      );
    } else {
      expect(request.headers[X_B3_TRACE_ID]).toBeUndefined();
      expect(request.headers[X_B3_SPAN_ID]).toBeUndefined();
      expect(request.headers[X_B3_SAMPLED]).toBeUndefined();
    }

    return request.headers;
  };

  describe('enable/disable', () => {
    afterEach(() => {
      XMLHttpRequest.prototype.open = originalOpenFunction;
      XMLHttpRequest.prototype.send = originalSendFunction;
    });

    it('should wrap XHR prototype when instantiated', () => {
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeFalsy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeFalsy();
      instrumentation = new XhrInstrumentation();
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeTruthy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeTruthy();
    });

    it('should not wrap XHR prototype when instantiated with `enabled: false`', () => {
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeFalsy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeFalsy();
      instrumentation = new XhrInstrumentation({ enabled: false });
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeFalsy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeFalsy();
      instrumentation.enable();
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeTruthy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeTruthy();
    });

    it('should not unwrap XHR prototype when disabled', () => {
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeFalsy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeFalsy();
      instrumentation = new XhrInstrumentation();
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeTruthy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeTruthy();
      instrumentation.disable();
      expect(isWrapped(XMLHttpRequest.prototype.open)).toBeTruthy();
      expect(isWrapped(XMLHttpRequest.prototype.send)).toBeTruthy();
    });
    const wrappedMethods = ['open', 'send'];
    // Same behavior regardless the method that has the error
    wrappedMethods.forEach((method) => {
      describe(`when the XHR prototype "${method}" cannot be wrapped`, () => {
        // Simulate the production failure mode (third-party scripts locking
        // `XMLHttpRequest.prototype.send` via `Object.defineProperty` with `writable: false,
        // configurable: false`) by stubbing `_wrap` to throw the same TypeError
        // the browser would throw. We stub the method rather than actually
        // locking the property because a non-configurable slot is irreversible
        // within a realm, and the outer `afterEach` restores `globalThis.fetch`
        // via assignment, which would itself throw.
        const wrapError = new TypeError(
          `Cannot assign to read only property '${method}' of object '[object XMLHttpRequest.prototype]'`,
        );

        beforeEach(() => {
          // Construct with `enabled: false` so the stub is in place before
          // `enable()` runs — `_wrap` is an instance-level field inherited
          // from `InstrumentationBase`, not a prototype method.
          instrumentation = new XhrInstrumentation({ enabled: false });
          // @ts-expect-error access internal property for testing
          vi.spyOn(instrumentation, '_wrap').mockImplementation(
            // @ts-expect-error TS does not get the type properly
            (_target: unknown, prop: string) => {
              if (prop === method) {
                throw wrapError;
              }
            },
          );
        });

        it('should not throw when _wrap fails', () => {
          expect(() => instrumentation.enable()).not.toThrow();
        });

        it('should leave XHR prototype unwrapped when _wrap fails', () => {
          instrumentation.enable();
          expect(
            isWrapped(globalThis.XMLHttpRequest.prototype.open),
          ).toBeFalsy();
          expect(
            isWrapped(globalThis.XMLHttpRequest.prototype.send),
          ).toBeFalsy();
        });

        it('should allow enable() to be retried after _wrap fails', () => {
          instrumentation.enable();
          expect(() => instrumentation.enable()).not.toThrow();
        });
      });
    });
  });

  describe('instrumentation', () => {
    beforeAll(() => {
      instrumentation = new XhrInstrumentation();
    });

    it('should still do the Request even if the instrumentation fails', async () => {
      const injectSpy = vi
        .spyOn(propagation, 'inject')
        .mockThrow('Injection Error');
      const url = getUrlForPath('/api/get');
      const result = await doXhrRequest({ method: 'GET', url }).then((r) =>
        r.json(),
      );

      // inject is called
      expect(injectSpy).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
      injectSpy.mockReset();
    });

    // NOTE: test of the former instrumentation also check for
    // XHR opened with async=false. Doing such request here makes the test
    // to timeout. This is probably because MSW handlers work in the same thread.
    it('should create spans when the request is "sent"', async () => {
      const delay = 50;
      const url = getUrlForPath('/api/get');
      const xhr = new XMLHttpRequest();
      const openTime = hrTime(performance.now());
      xhr.open('GET', url);

      // Simulate some work between open and send
      await new Promise((r) => setTimeout(r, delay));

      const startTime = performance.now();
      let endTime = 0;
      xhr.send();
      xhr.onload = () => (endTime = performance.now());

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);
      // Span is sterted after the delay between open and send
      expect(
        hrTimeToMilliseconds(span.startTime) - hrTimeToMilliseconds(openTime),
      ).toBeGreaterThanOrEqual(delay);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should create spans for GET requests', async () => {
      const url = getUrlForPath('/api/get');
      const startTime = performance.now();
      await doXhrRequest({ method: 'GET', url }).then((r) => r.json());
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should create spans for POST requests', async () => {
      const url = getUrlForPath('/api/post');
      const startTime = performance.now();
      await doXhrRequest({ method: 'POST', url }).then((r) => r.json());
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('POST');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('POST');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toBeUndefined(); // requires config set to true
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should create spans for QUERY requests', async () => {
      const url = getUrlForPath('/api/query');
      const startTime = performance.now();
      await doXhrRequest({ method: 'QUERY', url }).then((r) => r.json());
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('QUERY');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('QUERY');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should create spans for reused XHRs', async () => {
      // @ts-expect-error access internal property for testing
      const endSpanSpy = vi.spyOn(instrumentation, '_endSpan');

      const firstUrl = getUrlForPath('/api/get');
      const secondUrl = getUrlForPath('/api/query');
      const response = await doXhrRequest({ method: 'GET', url: firstUrl });
      const request = response.request;

      // make another request with the same XHR
      await new Promise((resolve) => {
        request.open('GET', secondUrl);
        request.send();
        request.onloadend = resolve;
      });

      // Both spans are exported
      let span = await waitForSpan(firstUrl);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(firstUrl);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

      span = await waitForSpan(secondUrl);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(secondUrl);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

      // `_endSpan` should be called once per span
      expect(endSpanSpy).toHaveBeenCalledTimes(2);
      endSpanSpy.mockReset();
    });

    it('should create spans for requests with relative URLs', async () => {
      const url = '/api/get';
      const fullUrl = getUrlForPath(url);
      const startTime = performance.now();
      await doXhrRequest({ method: 'GET', url }).then((r) => r.json());
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(fullUrl);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(fullUrl);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url: fullUrl, startTime, endTime });
    });

    it('should not record an error when the request is intentionally aborted', async () => {
      const url = getUrlForPath('/api/get');
      const startTime = performance.now();
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.send();
      xhr.abort();
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBeUndefined();
      expect(span.attributes[ATTR_ERROR_TYPE]).toBeUndefined();
      expect(span.status.code).toEqual(SpanStatusCode.UNSET);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should record an error when the request is aborted by a timeout', async () => {
      const timeout = 50;
      const url = getUrlForPath('/api/stream');
      const startTime = performance.now();
      const xhr = new XMLHttpRequest();
      xhr.timeout = timeout;
      xhr.open('GET', url);
      xhr.send();

      // wait till the timeout has passed
      await new Promise((res) => setTimeout(res, timeout + 1));
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBeUndefined();
      expect(span.attributes[ATTR_ERROR_TYPE]).toEqual('TimeoutError');
      expect(span.status.code).toEqual(SpanStatusCode.ERROR);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should record the exception for failed requests', async () => {
      const url = getUrlForPath('/api/error');
      const startTime = performance.now();
      await doXhrRequest({ method: 'GET', url });
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(500);
      expect(span.status.code).toEqual(SpanStatusCode.ERROR);
      expect(span.attributes[ATTR_ERROR_TYPE]).toEqual('500');

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should record the exception for network errors', async () => {
      const url = getUrlForPath('/api/network-error');
      const startTime = performance.now();
      // We know this is goin to throw
      try {
        const response = await doXhrRequest({ method: 'GET', url });
        expect(response).not.toBeDefined(); // fail if we get a response
      } catch (err) {
        expect(err).toBeDefined();
      }
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBeUndefined();
      expect(span.status.code).toEqual(SpanStatusCode.ERROR);
      expect(span.attributes[ATTR_ERROR_TYPE]).toEqual('Error');

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('204 (No Content) will correctly end the span', async () => {
      const url = getUrlForPath('/null-body-204');
      const startTime = performance.now();
      await doXhrRequest({ method: 'GET', url });
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(204);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('205 (Reset Content) will correctly end the span', async () => {
      const url = getUrlForPath('/null-body-205');
      const startTime = performance.now();
      await doXhrRequest({ method: 'GET', url });
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(205);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('304 (Not Modified) will correctly end the span', async () => {
      const url = getUrlForPath('/null-body-304');
      const startTime = performance.now();
      await doXhrRequest({ method: 'GET', url });
      const endTime = performance.now();

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(304);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    describe('with sanitizeUrl configuration', () => {
      beforeAll(() => {
        instrumentation.setConfig({ sanitizeUrl: defaultSanitizeUrl });
      });
      afterAll(() => {
        instrumentation.setConfig({ sanitizeUrl: undefined });
      });

      it('should create spans for GET requests', async () => {
        const url = getUrlForPath('/api/get?api_key=secret&normal=value');
        const startTime = performance.now();
        await doXhrRequest({ method: 'GET', url }).then((r) => r.json());
        const endTime = performance.now();

        // Span is exported (with sanitized URL)
        const span = await waitForSpan(defaultSanitizeUrl(url));
        expect(span.name).toBe('GET');
        expect(span.kind).toEqual(SpanKind.CLIENT);
        expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
        expect(span.attributes[ATTR_URL_FULL]).toContain('api_key=REDACTED');
        expect(span.attributes[ATTR_URL_FULL]).toContain('normal=value');
        expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(
          VITEST_SERVER_NAME,
        );
        expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
        expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

        // Context has been registered for the resource
        assertResourceRegistered({ span, url, startTime, endTime });
      });
    });

    describe('with ignoreUrls configuration', () => {
      afterAll(() => {
        instrumentation.setConfig({ sanitizeUrl: undefined });
      });

      it('should not create spans for GET requests if URL matches', async () => {
        const url = getUrlForPath('/api/get');
        instrumentation.setConfig({ ignoreUrls: [url] });
        await doXhrRequest({ method: 'GET', url });

        // No spans to export
        expect(async () => await waitForSpan(url)).rejects.toThrow();
        // No resource registered
        expect(networkContextRegistry.register).not.toHaveBeenCalled();
      });
    });

    describe('with measureRequestSize configuration', () => {
      it('should not measure the size if not set', async () => {
        const url = getUrlForPath('/api/post');
        await doXhrRequest({ method: 'POST', url, body: 'body_content' }).then(
          (r) => r.json(),
        );

        const span = await waitForSpan(url);
        expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toBeUndefined();
      });

      it('should not measure the size if set to false', async () => {
        instrumentation.setConfig({ measureRequestSize: false });
        const url = getUrlForPath('/api/post');
        await doXhrRequest({ method: 'POST', url, body: 'body_content' }).then(
          (r) => r.json(),
        );

        const span = await waitForSpan(url);
        expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toBeUndefined();
      });

      describe('with measureRequestSize set to true', () => {
        beforeAll(() => {
          instrumentation.setConfig({ measureRequestSize: true });
        });
        afterAll(() => {
          instrumentation.setConfig({ measureRequestSize: undefined });
        });

        it('should measure the size with string body', async () => {
          const body = 'body_content';
          const url = getUrlForPath('/api/post');
          await doXhrRequest({ method: 'POST', url, body }).then((r) =>
            r.json(),
          );

          const span = await waitForSpan(url);
          expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toEqual(
            body.length,
          );
        });

        it('should measure the size with a Request object and a URLSearchParams body', async () => {
          const body = new URLSearchParams({ hello: 'world' });
          const url = getUrlForPath('/api/post');
          await doXhrRequest({
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body,
          }).then((r) => r.json());

          const span = await waitForSpan(url);
          expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toEqual(
            'hello=world'.length,
          );
        });
      });
    });

    describe('with applyCustomAttributesOnSpan configuration', () => {
      afterEach(() => {
        instrumentation.setConfig({ applyCustomAttributesOnSpan: undefined });
      });

      it('should not break fetch or instrumentation if throws', async () => {
        instrumentation.setConfig({
          applyCustomAttributesOnSpan: () => {
            throw new Error('boom');
          },
        });
        const url = getUrlForPath('/api/get');
        const startTime = performance.now();
        await doXhrRequest({ method: 'GET', url }).then((r) => r.json());
        const endTime = performance.now();

        // Span is exported
        const span = await waitForSpan(url);
        expect(span.name).toBe('GET');
        expect(span.kind).toEqual(SpanKind.CLIENT);
        expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
        expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
        expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(
          VITEST_SERVER_NAME,
        );
        expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
        expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

        // Context has been registered for the resource
        assertResourceRegistered({ span, url, startTime, endTime });
      });

      it('should be able to set attributes on the span', async () => {
        instrumentation.setConfig({
          applyCustomAttributesOnSpan: (span) => {
            span.setAttribute('custom.foo', 'bar');
          },
        });
        const url = getUrlForPath('/api/get');
        const startTime = performance.now();
        await doXhrRequest({ method: 'GET', url }).then((r) => r.json());
        const endTime = performance.now();

        // Span is exported
        const span = await waitForSpan(url);
        expect(span.name).toBe('GET');
        expect(span.kind).toEqual(SpanKind.CLIENT);
        expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
        expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
        expect(span.attributes['custom.foo']).toEqual('bar');

        // Context has been registered for the resource
        assertResourceRegistered({ span, url, startTime, endTime });
      });

      it('should be able to access to XHR object', async () => {
        instrumentation.setConfig({
          applyCustomAttributesOnSpan: (span, xhr) => {
            span.setAttribute('has.xhr.access', xhr instanceof XMLHttpRequest);
          },
        });
        const url = getUrlForPath('/api/get');
        await doXhrRequest({ method: 'GET', url }).then((r) => r.json());

        // Span is exported
        const span = await waitForSpan(url);
        expect(span.name).toBe('GET');
        expect(span.kind).toEqual(SpanKind.CLIENT);
        expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
        expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
        expect(span.attributes['has.xhr.access']).toEqual(true);
      });
    });

    describe('trace propagation headers', () => {
      describe('without global propagator', () => {
        it('should not set trace propagation headers', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await doXhrRequest({ method: 'GET', url });

          await assertPropagationHeaders(response);
        });

        it('should keep custom headers', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await doXhrRequest({
            method: 'GET',
            url,
            headers: { foo: 'bar' },
          });
          const headers = await assertPropagationHeaders(response);

          expect(headers['foo']).toEqual('bar');
        });
      });

      describe('with global propagator', () => {
        beforeAll(() => {
          propagation.setGlobalPropagator(
            new B3Propagator({
              injectEncoding: B3InjectEncoding.MULTI_HEADER,
            }),
          );
        });

        afterAll(() => {
          propagation.disable();
        });

        it('should set trace propagation headers', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await doXhrRequest({ method: 'GET', url });
          const span = await waitForSpan(url);

          await assertPropagationHeaders(response, span);
        });
      });
    });

    // ServiceWorker request interception occurs before CORS preflight requests
    // are made. If a request is handled by the SW, it won't cause a preflight
    // (at least not on the page – if the SW makes its own "real" request while
    // responding to the fetch event, that request may very well require CORS &
    // preflight, but that would be happening within the SW, not the page.)
    //
    // However, as far as the instrumentation behavior, there aren't much that
    // we need to specifically unit test in relation to CORS and preflights,
    // since preflight requests are completely transparent, the instrumentation
    // code could not detect that it happened, let alone report on its timing:
    // https://github.com/open-telemetry/opentelemetry-js/issues/5122
    //
    // So the purpose of this test module is mostly just to test the configs
    // related to CORS requests.
    describe('cross origin requests', () => {
      it('should not break for CORS requests', async () => {
        const url = 'http://example.com/api/status.json';
        const startTime = performance.now();
        await doXhrRequest({ method: 'GET', url }).then((r) => r.json());
        const endTime = performance.now();

        // Span is exported
        const span = await waitForSpan(url);
        expect(span.name).toBe('GET');
        expect(span.kind).toEqual(SpanKind.CLIENT);
        expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
        expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
        expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual('example.com');
        expect(span.attributes[ATTR_SERVER_PORT]).toEqual(80);
        expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

        // Context has been registered for the resource
        assertResourceRegistered({ span, url, startTime, endTime });
      });

      describe('with propagateTraceHeaderCorsUrls configuration', () => {
        afterEach(() => {
          instrumentation.setConfig({
            propagateTraceHeaderCorsUrls: [],
          });
        });

        describe('without global propagator', () => {
          it('should not set trace propagation headers with no `propagateTraceHeaderCorsUrls`', async () => {
            const url = 'http://example.com/api/echo-headers.json';
            const response = await doXhrRequest({ method: 'GET', url });

            await assertPropagationHeaders(response);
          });

          it('should not set trace propagation headers even with with `propagateTraceHeaderCorsUrls`', async () => {
            instrumentation.setConfig({
              propagateTraceHeaderCorsUrls: [/example.com/],
            });
            const url = 'http://example.com/api/echo-headers.json';
            const response = await doXhrRequest({ method: 'GET', url });

            await assertPropagationHeaders(response);
          });
        });

        describe('with global propagator', () => {
          beforeAll(() => {
            propagation.setGlobalPropagator(
              new B3Propagator({
                injectEncoding: B3InjectEncoding.MULTI_HEADER,
              }),
            );
          });

          afterAll(() => {
            propagation.disable();
          });

          it('should not set trace propagation headers with no `propagateTraceHeaderCorsUrls`', async () => {
            const url = 'http://example.com/api/echo-headers.json';
            const response = await doXhrRequest({ method: 'GET', url });

            await assertPropagationHeaders(response);
          });

          it('should not set trace propagation headers even with with `propagateTraceHeaderCorsUrls`', async () => {
            instrumentation.setConfig({
              propagateTraceHeaderCorsUrls: [/example.com/],
            });
            const url = 'http://example.com/api/echo-headers.json';
            const response = await doXhrRequest({ method: 'GET', url });

            const span = await waitForSpan(url);
            await assertPropagationHeaders(response, span);
          });
        });
      });
    });
  });
});
