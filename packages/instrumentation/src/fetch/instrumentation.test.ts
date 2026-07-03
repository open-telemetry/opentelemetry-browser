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
    // instrumentation = new FetchInstrumentation();
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
    // const url = new URL(location.href);
    // url.pathname = path;
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

    it('should not wrap global fetch when instantiated with `enabled: false`', () => {
      expect(isWrapped(globalThis.fetch)).toBeFalsy();
      instrumentation = new FetchInstrumentation({ enabled: false });
      expect(isWrapped(globalThis.fetch)).toBeFalsy();
      instrumentation.enable();
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
      expect(span.attributes[ATTR_ERROR_TYPE]).toEqual('500');

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
      it('should create spans for GET requests', async () => {
        instrumentation.setConfig({ sanitizeUrl: defaultSanitizeUrl });
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
      it('should create spans for GET requests', async () => {
        const url = getUrlForPath('/api/get');
        instrumentation.setConfig({ ignoreUrls: [url] });
        await fetch(url);

        // No spans to export
        expect(async () => await waitForSpan(url)).rejects.toThrow();
        // No resource registered
        expect(networkContextRegistry.register).not.toHaveBeenCalled();
      });
    });

    describe('trace propagation headers', () => {
      const assertPropagationHeaders = async (
        response: Response,
        span?: ReadableSpan,
      ): Promise<Record<string, string>> => {
        const { request } = await response.json();

        if (span) {
          expect(request.headers[X_B3_TRACE_ID]).toEqual(
            span.spanContext().traceId,
          );
          expect(request.headers[X_B3_SPAN_ID]).toEqual(
            span.spanContext().spanId,
          );
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
      const corsFetch = () =>
        fetch('http://example.com/api/status.json', {
          mode: 'cors',
          headers: { 'x-custom': 'custom value' },
        });
      it.skip('should create a span with correct root span', async () => {
        await corsFetch();
        // XXX: implement tests
      });
    });
  });
});
