/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { isWrapped } from '@opentelemetry/instrumentation';
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
import { getNetworkContextRegistry } from '#utils';
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
    const url = new URL(location.href);
    url.pathname = path;
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
      expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toEqual(200);

      // Context has been registered for the resource
      assertResourceRegistered({ span, url, startTime, endTime });
    });

    it('should create spans for POST requests', async () => {
      const url = getUrlForPath('/api/post');
      const startTime = performance.now();
      await fetch(url, { method: 'post', body: 'body_content' });
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
      await fetch(url, { method: 'QUERY' });
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
  });
});
