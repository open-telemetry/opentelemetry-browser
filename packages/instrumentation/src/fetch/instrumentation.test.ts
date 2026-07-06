/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { propagation, SpanKind, SpanStatusCode } from '@opentelemetry/api';
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
} from '@opentelemetry/sdk-trace-base';
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
import { FetchInstrumentation } from './instrumentation.ts';
import { ATTR_HTTP_REQUEST_BODY_SIZE } from './semconv.ts';

const VITEST_SERVER_URL = new URL(location.href);
const VITEST_SERVER_NAME = VITEST_SERVER_URL.hostname;
const VITEST_SERVER_PORT = parseInt(VITEST_SERVER_URL.port, 10);
const originalFetchFunction = globalThis.fetch;
const networkContextRegistry = getNetworkContextRegistry();

export const handlers = [
  http.get('/api/get', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.post('/api/post', () => {
    return HttpResponse.json({ ok: true });
  }),
  // MSW does nt have a specific handler for query
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
  http.get(`${location.origin}/test.wasm`, () => {
    // Minimal valid WASM binary: magic number + version only.
    const wasmBytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ]);
    return new HttpResponse(wasmBytes, {
      headers: { 'Content-Type': 'application/wasm' },
    });
  }),
  http.get('/no-such-path', () => {
    return new HttpResponse(null, { status: 404 });
  }),
  http.get('/boom', () => {
    return new HttpResponse(null, { status: 500 });
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

describe('FetchInstrumentation', () => {
  let inMemoryExporter: InMemorySpanExporter;
  let instrumentation: FetchInstrumentation;

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

  const scopeName = '@opentelemetry/browser-instrumentation/fetch';
  const getFetchSpans = () =>
    inMemoryExporter
      .getFinishedSpans()
      .filter((span) => span.instrumentationScope.name === scopeName);

  const waitForSpan = async (
    url: string,
    timeoutMs = 1000,
  ): Promise<ReturnType<typeof getFetchSpans>[0]> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const spans = getFetchSpans();
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

  const assertPropagationHeaders = async (
    response: Response,
    span?: ReadableSpan,
  ): Promise<Record<string, string>> => {
    const { request } = await response.json();

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
      globalThis.fetch = originalFetchFunction;
    });

    it('should wrap global fetch when instantiated', () => {
      expect(isWrapped(globalThis.fetch)).toBeFalsy();
      instrumentation = new FetchInstrumentation();
      expect(isWrapped(globalThis.fetch)).toBeTruthy();
    });

    it('should not wrap global fetch when instantiated with `enabled: false`', () => {
      expect(isWrapped(globalThis.fetch)).toBeFalsy();
      instrumentation = new FetchInstrumentation({ enabled: false });
      expect(isWrapped(globalThis.fetch)).toBeFalsy();
      instrumentation.enable();
      expect(isWrapped(globalThis.fetch)).toBeTruthy();
    });

    it('should not unwrap global fetch when disabled', () => {
      expect(isWrapped(globalThis.fetch)).toBeFalsy();
      instrumentation = new FetchInstrumentation();
      expect(isWrapped(globalThis.fetch)).toBeTruthy();
      instrumentation.disable();
      expect(isWrapped(globalThis.fetch)).toBeTruthy();
    });

    describe('when the fetch property cannot be wrapped', () => {
      // Simulate the production failure mode (third-party scripts locking
      // `globalThis.fetch` via `Object.defineProperty` with `writable: false,
      // configurable: false`) by stubbing `_wrap` to throw the same TypeError
      // the browser would throw. We stub the method rather than actually
      // locking the property because a non-configurable slot is irreversible
      // within a realm, and the outer `afterEach` restores `globalThis.fetch`
      // via assignment, which would itself throw.
      const wrapError = new TypeError(
        "Cannot assign to read only property 'fetch' of object '[object Window]'",
      );

      beforeEach(() => {
        // Construct with `enabled: false` so the stub is in place before
        // `enable()` runs — `_wrap` is an instance-level field inherited
        // from `InstrumentationBase`, not a prototype method.
        instrumentation = new FetchInstrumentation({ enabled: false });
        // @ts-expect-error access internal property for testing
        vi.spyOn(instrumentation, '_wrap').mockThrow(wrapError);
      });

      it('should not throw when _wrap fails', () => {
        expect(() => instrumentation.enable()).not.toThrow();
      });

      it('should leave fetch unwrapped when _wrap fails', () => {
        instrumentation.enable();
        expect(isWrapped(globalThis.fetch)).toBeFalsy();
      });

      it('should allow enable() to be retried after _wrap fails', () => {
        instrumentation.enable();
        expect(() => instrumentation.enable()).not.toThrow();
      });
    });
  });

  describe('instrumentation', () => {
    beforeAll(() => {
      instrumentation = new FetchInstrumentation();
    });

    it('should still do the Request even if the instrumentation fails', async () => {
      const injectSpy = vi
        .spyOn(propagation, 'inject')
        .mockThrow('Injection Error');
      const url = getUrlForPath('/api/get');
      const result = await fetch(url).then((r) => r.json());

      // inject is called
      expect(injectSpy).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
      injectSpy.mockReset();
    });

    it('should create spans for GET requests', async () => {
      const url = getUrlForPath('/api/get');
      const startTime = performance.now();
      await fetch(url).then((r) => r.json());
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
      await fetch(url, { method: 'post', body: 'body_content' }).then((r) =>
        r.json(),
      );
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
      await fetch(url, { method: 'QUERY' }).then((r) => r.json());
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

    it('should record the exception for failed requests', async () => {
      const url = getUrlForPath('/api/error');
      const startTime = performance.now();
      await fetch(url);
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
      expect(span.attributes[ATTR_ERROR_TYPE]).toEqual('Internal Server Error');

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should record the exception for network errors', async () => {
      const url = getUrlForPath('/api/network-error');
      const startTime = performance.now();
      // We know this is goint to throw
      try {
        const response = await fetch(url);
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
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(0);
      expect(span.status.code).toEqual(SpanStatusCode.ERROR);
      expect(span.attributes[ATTR_ERROR_TYPE]).toEqual('Failed to fetch');

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('204 (No Content) will correctly end the span', async () => {
      const url = getUrlForPath('/null-body-204');
      await fetch(url);

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(204);
    });

    it('205 (Reset Content) will correctly end the span', async () => {
      const url = getUrlForPath('/null-body-205');
      await fetch(url);

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(205);
    });

    it('304 (Not Modified) will correctly end the span', async () => {
      const url = getUrlForPath('/null-body-304');
      await fetch(url);

      // Span is exported
      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_ADDRESS]).toEqual(VITEST_SERVER_NAME);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(VITEST_SERVER_PORT);
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(304);
    });

    it('should return a Promise<Response> compatible with WebAssembly.compileStreaming', async () => {
      // Some web APIs do brand checks to ensure they are working with native objects.
      // compileStreaming checks that the argument is a native Response, and will throw if it isn't.
      // WebAssembly.compileStreaming requires a native Response from fetch.
      const module = await WebAssembly.compileStreaming(
        fetch(`${location.origin}/test.wasm`),
      );
      expect(module instanceof WebAssembly.Module).toBeTruthy();
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
        await fetch(url).then((r) => r.json());
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
        await fetch(url);

        // No spans to export
        expect(async () => await waitForSpan(url)).rejects.toThrow();
        // No resource registered
        expect(networkContextRegistry.register).not.toHaveBeenCalled();
      });
    });

    describe('with measureRequestSize configuration', () => {
      it('should not measure the size if not set', async () => {
        const url = getUrlForPath('/api/post');
        await fetch(url, { method: 'post', body: 'body_content' }).then((r) =>
          r.json(),
        );

        const span = await waitForSpan(url);
        expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toBeUndefined();
      });

      it('should not measure the size if set to false', async () => {
        instrumentation.setConfig({ measureRequestSize: false });
        const url = getUrlForPath('/api/post');
        await fetch(url, { method: 'post', body: 'body_content' }).then((r) =>
          r.json(),
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

        it('should measure the size with URL and init object', async () => {
          const body = 'body_content';
          const url = getUrlForPath('/api/post');
          await fetch(url, { method: 'post', body }).then((r) => r.json());

          const span = await waitForSpan(url);
          expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toEqual(
            body.length,
          );
        });

        it('should measure the size with url and init object with a body stream', async () => {
          const url = getUrlForPath('/api/post');
          const body = JSON.stringify({ hello: 'world' });
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start: (controller) => {
              controller.enqueue(encoder.encode(body));
              controller.close();
            },
            cancel: (controller) => {
              controller.close();
            },
          });
          await fetch(url, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: stream,
            // @ts-expect-error this is required IRL but missing on the current TS definition
            // https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests#half_duplex
            duplex: 'half',
          }).then((r) => r.json());

          const span = await waitForSpan(url);
          expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toEqual(
            body.length,
          );
        });

        it('should measure the size with a Request object', async () => {
          const body = JSON.stringify({ hello: 'world' });
          const url = getUrlForPath('/api/post');
          await fetch(
            new Request(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body,
            }),
          ).then((r) => r.json());

          const span = await waitForSpan(url);
          expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toEqual(
            body.length,
          );
        });

        it('should measure the size with a Request object and a URLSearchParams body', async () => {
          const body = new URLSearchParams({ hello: 'world' });
          const url = getUrlForPath('/api/post');
          await fetch(
            new Request(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body,
            }),
          ).then((r) => r.json());

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

      it('should not break fetch or instrumentation of throws', async () => {
        instrumentation.setConfig({
          applyCustomAttributesOnSpan: () => {
            throw new Error('boom');
          },
        });
        const url = getUrlForPath('/api/get');
        const startTime = performance.now();
        await fetch(url).then((r) => r.json());
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
        await fetch(url).then((r) => r.json());
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

      it('should be able to acces to Request and Response', async () => {
        instrumentation.setConfig({
          applyCustomAttributesOnSpan: (span, req, res) => {
            const reqHeaders = req.headers as Headers;
            const resHeaders = (res as Response).headers;

            // Set some attribs to do expectations later
            span.setAttribute('has.req.access', reqHeaders instanceof Headers);
            span.setAttribute('has.res.access', resHeaders instanceof Headers);
            span.setAttribute('req.header.foo', reqHeaders.get('foo') || '');
            span.setAttribute(
              'res.header.ctype',
              resHeaders.get('content-type') || '',
            );
            /*
            Note: this confirms that nothing *in the instrumentation code*
            consumed the response body; it doesn't guarantee that the response
            object passed to the `applyCustomAttributes` hook will always have
            a consumable body – in fact, this is typically *not* the case:

            ```js
            // user code:
            let response = await fetch("foo");
            let json = await response.json(); // <- user code consumes the body on `response`
            // ...

            {
              // ...this is called sometime later...
              applyCustomAttributes(span, request, response) {
                // too late!
                response.bodyUsed // => true
              }
            }
            ```

            See https://github.com/open-telemetry/opentelemetry-js/pull/5281
          */
            span.setAttribute('res.body.used', (res as Response).bodyUsed);
          },
        });
        const url = getUrlForPath('/api/get');
        await fetch(url, { headers: { foo: 'bar' } });

        // Span is exported
        const span = await waitForSpan(url);
        expect(span.name).toBe('GET');
        expect(span.kind).toEqual(SpanKind.CLIENT);
        expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
        expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
        expect(span.attributes['has.req.access']).toEqual(true);
        expect(span.attributes['has.res.access']).toEqual(true);
        expect(span.attributes['req.header.foo']).toEqual('bar');
        expect(span.attributes['res.header.ctype']).toEqual('application/json');
        expect(span.attributes['res.body.used']).toEqual(false);
      });

      // https://github.com/open-telemetry/opentelemetry-js/pull/5281
      it('should not be able to access the response body if already consumed', async () => {
        instrumentation.setConfig({
          applyCustomAttributesOnSpan: (span, _req, res) => {
            span.setAttribute('res.body.used', (res as Response).bodyUsed);
          },
        });
        const url = getUrlForPath('/api/get');
        const startTime = performance.now();
        await fetch(url).then((r) => r.json());
        const endTime = performance.now();

        // Span is exported
        const span = await waitForSpan(url);
        expect(span.name).toBe('GET');
        expect(span.kind).toEqual(SpanKind.CLIENT);
        expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
        expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
        expect(span.attributes['res.body.used']).toEqual(true);

        // Context has been registered for the resource
        assertResourceRegistered({ span, url, startTime, endTime });
      });
    });

    describe('trace propagation headers', () => {
      describe('without global propagator', () => {
        it('should not set trace propagation headers', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url);

          await assertPropagationHeaders(response);
        });

        it('should not set trace propagation headers with a Request object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(new Request(url));

          await assertPropagationHeaders(response);
        });

        it('should keep custom headers with a request object and a headers object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(
            new Request(url, { headers: new Headers({ foo: 'bar' }) }),
          );
          const headers = await assertPropagationHeaders(response);

          expect(headers['foo']).toEqual('bar');
        });

        it('should keep custom headers with url, untyped request object and untyped headers object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url, { headers: { foo: 'bar' } });
          const headers = await assertPropagationHeaders(response);

          expect(headers['foo']).toEqual('bar');
        });

        it('should keep custom headers with url, untyped request object and typed (Map) headers object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url, {
            // @ts-expect-error relies on implicit coercion
            headers: new Map().set('foo', 'bar'),
          });
          const headers = await assertPropagationHeaders(response);

          expect(headers['foo']).toEqual('bar');
        });

        it('should keep custom headers with url, untyped request object and tuple array headers', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url, {
            headers: [
              ['foo', 'bar'],
              ['content-type', 'application/json'],
            ],
          });
          const headers = await assertPropagationHeaders(response);

          expect(headers['foo']).toEqual('bar');
          expect(headers['content-type']).toEqual('application/json');
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
          const response = await fetch(url);
          const span = await waitForSpan(url);

          await assertPropagationHeaders(response, span);
        });

        it('should set trace propagation headers with a Request object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(new Request(url));
          const span = await waitForSpan(url);

          await assertPropagationHeaders(response, span);
        });

        it('should keep custom headers from init overrides when first arg is a Request object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(
            new Request(url, { headers: { foo: 'bar' } }),
          );
          const span = await waitForSpan(url);
          const headers = await assertPropagationHeaders(response, span);

          expect(headers['foo']).toEqual('bar');
        });

        it('should keep custom headers from init overrides with typed Headers when first arg is a Request object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(
            new Request(url, { headers: new Headers({ foo: 'bar' }) }),
          );
          const span = await waitForSpan(url);
          const headers = await assertPropagationHeaders(response, span);

          expect(headers['foo']).toEqual('bar');
        });

        it('should merge headers from Request and init overrides with init taking precedence', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(
            new Request(url, {
              headers: {
                'x-from-request': 'request-value',
                shared: 'from-request',
              },
            }),
            {
              headers: {
                'x-from-init': 'init-value',
                shared: 'from-init',
              },
            },
          );
          const span = await waitForSpan(url);
          const headers = await assertPropagationHeaders(response, span);

          // XXX: check if original implementation actually merges
          // expect(headers['x-from-request']).toEqual('request-value');
          expect(headers['x-from-init']).toEqual('init-value');
          expect(headers['shared']).toEqual('from-init');
        });

        it('should keep custom headers with url, untyped request object and typed (Headers) headers object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url, {
            headers: new Headers({ foo: 'bar' }),
          });
          const span = await waitForSpan(url);
          const headers = await assertPropagationHeaders(response, span);

          expect(headers['foo']).toEqual('bar');
        });

        it('should keep custom headers with url, untyped request object and untyped headers object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url, { headers: { foo: 'bar' } });
          const span = await waitForSpan(url);
          const headers = await assertPropagationHeaders(response, span);

          expect(headers['foo']).toEqual('bar');
        });

        it('should keep custom headers with url, untyped request object and typed (Map) headers object', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url, {
            // @ts-expect-error relies on implicit coercion
            headers: new Map().set('foo', 'bar'),
          });
          const span = await waitForSpan(url);
          const headers = await assertPropagationHeaders(response, span);

          expect(headers['foo']).toEqual('bar');
        });

        it('should keep custom headers with url, untyped request object and tuple array headers', async () => {
          const url = getUrlForPath('/api/echo-headers.json');
          const response = await fetch(url, {
            headers: [
              ['foo', 'bar'],
              ['content-type', 'application/json'],
            ],
          });
          const span = await waitForSpan(url);
          const headers = await assertPropagationHeaders(response, span);

          expect(headers['foo']).toEqual('bar');
          expect(headers['content-type']).toEqual('application/json');
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
        await fetch(url).then((r) => r.json());
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

      describe('trace propagation headers', () => {
        afterEach(() => {
          instrumentation.setConfig({
            propagateTraceHeaderCorsUrls: [],
          });
        });

        describe('without global propagator', () => {
          it('should not set trace propagation headers with no `propagateTraceHeaderCorsUrls`', async () => {
            const url = 'http://example.com/api/echo-headers.json';
            const response = await fetch(url);

            await assertPropagationHeaders(response);
          });

          it('should not set trace propagation headers even with with `propagateTraceHeaderCorsUrls`', async () => {
            instrumentation.setConfig({
              propagateTraceHeaderCorsUrls: [/example.com/],
            });
            const url = 'http://example.com/api/echo-headers.json';
            const response = await fetch(url);

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
            const response = await fetch(url);

            await assertPropagationHeaders(response);
          });

          it('should not set trace propagation headers even with with `propagateTraceHeaderCorsUrls`', async () => {
            instrumentation.setConfig({
              propagateTraceHeaderCorsUrls: [/example.com/],
            });
            const url = 'http://example.com/api/echo-headers.json';
            const response = await fetch(url);

            const span = await waitForSpan(url);
            await assertPropagationHeaders(response, span);
          });
        });
      });
    });

    describe('long-lived streaming requests', () => {
      it('should end the span when the stream completes', async () => {
        const url = getUrlForPath('/api/stream');
        const response = await fetch(url);

        expect(response.body instanceof ReadableStream).toBeTruthy();

        const reader = response.body?.getReader();
        expect(reader).toBeTruthy();

        const first = await reader!.read();
        const text = new TextDecoder().decode(first.value);
        expect(first.done).toBeFalsy();
        expect(text).toMatch(/^data: \d+\n$/);

        reader!.cancel('test-cancel');

        // We increase here the timeout since the stream takes a bit more than 1sec.
        // The instrumentation tracks completion via an eagerly-consumed clone;
        // consumer-side cancellation does not propagate to the clone.
        const span = await waitForSpan(url, 1500);
        expect(span.ended).toBeTruthy();
      });
    });
  });
});
