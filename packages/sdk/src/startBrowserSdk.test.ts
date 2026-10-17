/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProxyTracerProvider } from '@opentelemetry/api';
import { context, diag, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { Instrumentation } from '@opentelemetry/browser-instrumentation/experimental/instrumentation-base';
import { SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import type { MockInstance } from 'vitest';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { WebSdk } from './core/types.ts';
import { quickStartBrowserSdk, startBrowserSdk } from './startBrowserSdk.ts';

// Arrange
const SCHEDULE_DELAY = 10;

/**
 * Extracts the resource attributes from an OTLP/HTTP export request body
 * (either `resourceSpans` for traces or `resourceLogs` for logs) into a
 * simple key/value map so tests can assert on values like `service.name`.
 */
function resourceAttributesFromBody(
  body: BodyInit | null | undefined,
): Record<string, string> {
  const text =
    typeof body === 'string'
      ? body
      : new TextDecoder().decode(body as ArrayBuffer);
  const payload = JSON.parse(text);
  const resource =
    payload.resourceSpans?.[0]?.resource ?? payload.resourceLogs?.[0]?.resource;
  const attributes: Record<string, string> = {};
  for (const attr of resource?.attributes ?? []) {
    attributes[attr.key] = attr.value?.stringValue;
  }
  return attributes;
}

function createFakeInstrumentation(instrumentationName = 'fake') {
  return {
    instrumentationName,
    enable: vi.fn(),
    disable: vi.fn(),
    isEnabled: vi.fn(),
  } satisfies Instrumentation;
}

describe('startBrowserSdk', () => {
  const response = { ok: true, json: async () => ({ ok: true }) } as Response;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const diagErrorSpy = vi.spyOn(diag, 'error');
  let browserSdk: WebSdk | undefined;

  // NOTE: we mock the registration of the logger/tracer provider because
  // the APIs only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    fetchSpy.mockRestore();
  });
  afterEach(async () => {
    await browserSdk?.shutdown();
    browserSdk = undefined;
    fetchSpy.mockClear();
    logs.disable();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  it('should not start if an invalid URL is provided', async () => {
    // Act
    browserSdk = startBrowserSdk({
      exportConfig: {
        url: 'this_is_not_an_URL',
      },
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert
    expect(browserSdk.invalidConfig).toStrictEqual(true);
    expect(diagErrorSpy).toHaveBeenCalled();
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(/Browser SDK won't start/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should not start for an invalid signal-specific URL even with custom processors', async () => {
    // Arrange: the traces signal provides its own processors and an invalid
    // export URL — the scenario the sandbox used to guard against by hand.
    let exportCalled = false;

    // Act
    browserSdk = startBrowserSdk({
      // NOTE: short delay so a logs signal that wrongly started would flush
      // within the wait below, which is what `fetchSpy` asserts against.
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
      traces: {
        processors: [
          new SimpleSpanProcessor({
            exporter: {
              export: () => (exportCalled = true),
              shutdown: () => Promise.resolve(),
            },
          }),
        ],
        exportConfig: { url: 'this_is_not_an_URL' },
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert
    expect(browserSdk.invalidConfig).toStrictEqual(true);
    expect(diagErrorSpy).toHaveBeenCalled();
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(
      /Invalid OTLP export URL "this_is_not_an_URL". Traces SDK won't start/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(exportCalled).toStrictEqual(false);
  });

  it('should start where URL.parse is not available', async () => {
    // Arrange: Safari < 18 and Chrome/Firefox < 126 have no `URL.parse`
    const urlParse = Object.getOwnPropertyDescriptor(URL, 'parse');
    Reflect.deleteProperty(URL, 'parse');

    try {
      // Act
      browserSdk = startBrowserSdk({
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        batchProcessorConfig: {
          scheduledDelayMillis: SCHEDULE_DELAY,
        },
      });
      logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
      trace.getTracer('traces-sdk-test').startSpan('test').end();
      await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));
    } finally {
      if (urlParse) {
        Object.defineProperty(URL, 'parse', urlParse);
      }
    }

    // Assert
    expect(browserSdk.invalidConfig).toBeFalsy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should use the default configuration for batch processor', async () => {
    // Act
    browserSdk = startBrowserSdk({
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert
    expect(browserSdk.invalidConfig).toBeFalsy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://localhost:4318/v1/logs',
      ),
    ).toBeDefined();
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://localhost:4318/v1/traces',
      ),
    ).toBeDefined();
  });

  it('should accept exporter confgiration with URL and headers', async () => {
    // Act
    browserSdk = startBrowserSdk({
      batchProcessorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318',
        headers: { bar: 'baz' },
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mock.calls.forEach((args) => {
      expect(args[1]).containSubset({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          bar: 'baz',
        },
      });
    });
  });

  it("enables instrumentations with the SDK's providers and propagator", () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = startBrowserSdk({
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert
    expect(instrumentation.enable).toHaveBeenCalledOnce();
    const deps = instrumentation.enable.mock.lastCall?.[0];
    expect(deps).toStrictEqual({
      tracerProvider: expect.anything(),
      loggerProvider: expect.anything(),
      propagator: expect.anything(),
    });
    expect(
      (trace.getTracerProvider() as ProxyTracerProvider).getDelegate(),
    ).toBe(deps.tracerProvider);
  });

  it('enabled: false builds the SDK but does not enable instrumentations, and sdk.enable() does', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = startBrowserSdk({
      enabled: false,
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });
    // Consent covers instrumentations only, so manual telemetry still exports
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert
    expect(browserSdk.invalidConfig).toBeFalsy();
    expect(instrumentation.enable).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Act
    browserSdk.enable();

    // Assert
    expect(instrumentation.enable).toHaveBeenCalledOnce();
    expect(instrumentation.enable.mock.lastCall?.[0]).toMatchObject({
      tracerProvider: expect.anything(),
      loggerProvider: expect.anything(),
      propagator: expect.anything(),
    });
  });

  it('sdk.disable() then sdk.enable() passes the same deps object both times', () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();
    browserSdk = startBrowserSdk({
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Act
    browserSdk.disable();
    browserSdk.enable();

    // Assert
    expect(instrumentation.disable).toHaveBeenCalledOnce();
    expect(instrumentation.enable).toHaveBeenCalledTimes(2);
    const [first, second] = instrumentation.enable.mock.calls;
    expect(second?.[0]).toBe(first?.[0]);
  });

  it('shutdown disables instrumentations, then enable() does nothing', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();
    const sdk = startBrowserSdk({
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Act
    await sdk.shutdown();
    sdk.enable();
    sdk.disable();

    // Assert
    expect(instrumentation.enable).toHaveBeenCalledOnce();
    expect(instrumentation.disable).toHaveBeenCalledOnce();
  });

  it('one instrumentation that throws from enable or disable does not stop the others; the error is logged', async () => {
    // Arrange
    const failing = createFakeInstrumentation('failing');
    failing.enable.mockImplementation(() => {
      throw new Error('enable failed');
    });
    failing.disable.mockImplementation(() => {
      throw new Error('disable failed');
    });
    const healthy = createFakeInstrumentation('healthy');
    diagErrorSpy.mockClear();

    // Act
    const sdk = startBrowserSdk({
      instrumentations: [failing, healthy],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert
    expect(healthy.enable).toHaveBeenCalledOnce();
    expect(diagErrorSpy).toHaveBeenCalledOnce();
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(/failing/);

    // Act
    sdk.disable();

    // Assert
    expect(healthy.disable).toHaveBeenCalledOnce();
    expect(diagErrorSpy).toHaveBeenCalledTimes(2);
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(/failing/);

    // Act
    sdk.enable();
    await sdk.shutdown();

    // Assert: shutdown also continues past the failing instance
    expect(healthy.enable).toHaveBeenCalledTimes(2);
    expect(healthy.disable).toHaveBeenCalledTimes(2);
    expect(diagErrorSpy).toHaveBeenCalledTimes(4);
  });

  it('setGlobals: false does not set the global tracer provider, logger provider, propagator or context manager', () => {
    // Arrange
    const earlierTracerProvider = new TracerProvider();
    trace.setGlobalTracerProvider(earlierTracerProvider);
    const setLoggerProviderSpy = vi.spyOn(logs, 'setGlobalLoggerProvider');
    const setPropagatorSpy = vi.spyOn(propagation, 'setGlobalPropagator');
    const setContextManagerSpy = vi.spyOn(context, 'setGlobalContextManager');
    const instrumentation = createFakeInstrumentation();

    try {
      // Act
      browserSdk = startBrowserSdk({
        setGlobals: false,
        instrumentations: [instrumentation],
        batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
      });

      // Assert
      expect(
        (trace.getTracerProvider() as ProxyTracerProvider).getDelegate(),
      ).toBe(earlierTracerProvider);
      expect(setLoggerProviderSpy).not.toHaveBeenCalled();
      expect(setPropagatorSpy).not.toHaveBeenCalled();
      expect(setContextManagerSpy).not.toHaveBeenCalled();
      // The instances still get the SDK's own providers through deps
      const deps = instrumentation.enable.mock.lastCall?.[0];
      expect(deps?.tracerProvider).toBeDefined();
      expect(deps?.tracerProvider).not.toBe(earlierTracerProvider);
      expect(deps?.loggerProvider).toBeDefined();
      expect(deps?.propagator).toBeDefined();
    } finally {
      setLoggerProviderSpy.mockRestore();
      setPropagatorSpy.mockRestore();
      setContextManagerSpy.mockRestore();
    }
  });

  it('should not register instrumentations when an invalid URL is provided', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = startBrowserSdk({
      exportConfig: {
        url: 'this_is_not_an_URL',
      },
      instrumentations: [instrumentation],
    });
    await browserSdk.shutdown();

    // Assert
    expect(instrumentation.enable).not.toHaveBeenCalled();
    expect(instrumentation.disable).not.toHaveBeenCalled();
  });
});

describe('quickStartBrowserSdk', () => {
  // NOTE: `status` is required so the OTLP exporter treats the response as a
  // success; these tests flush via `shutdown()` and would otherwise surface
  // the export failure.
  const response = {
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as Response;
  // NOTE: the spies are installed per-test so this suite does not depend on
  // the `startBrowserSdk` suite above, which shares the same `globalThis.fetch`
  // spy and restores it in its `afterAll`.
  let fetchSpy: MockInstance;
  let consoleDirSpy: MockInstance;
  let diagErrorSpy: MockInstance;
  let browserSdk: WebSdk;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    consoleDirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});
    diagErrorSpy = vi.spyOn(diag, 'error');
  });
  afterEach(async () => {
    // A test may already have shut the SDK down to flush its batch
    // processors; ignore the resulting "already shutdown" error so the
    // provider globals are always reset for the next test.
    try {
      await browserSdk?.shutdown();
    } catch {
      /* already shut down within the test */
    }
    fetchSpy.mockRestore();
    consoleDirSpy.mockRestore();
    diagErrorSpy.mockRestore();
    logs.disable();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  it('should forward the export URL and headers to the exporters', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'http://otlp-signal-endpoint:4318',
      exportHeaders: { bar: 'baz' },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    // NOTE: quick start uses batch processors with default (long) delays,
    // so we flush via shutdown instead of waiting for the scheduled export
    await browserSdk.shutdown();

    // Assert
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://otlp-signal-endpoint:4318/v1/logs',
      ),
    ).toBeDefined();
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://otlp-signal-endpoint:4318/v1/traces',
      ),
    ).toBeDefined();
    fetchSpy.mock.calls.forEach((args) => {
      expect(args[1]).containSubset({
        method: 'POST',
        headers: { bar: 'baz' },
      });
    });
    // Console output belongs to DEBUG and above. Without this, making the
    // console processors unconditional would leave every test green.
    expect(consoleDirSpy).not.toHaveBeenCalled();
  });

  it('should propagate service name and version as resource attributes', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'http://otlp-signal-endpoint:4318',
      serviceName: 'my-service',
      serviceVersion: '1.2.3',
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await browserSdk.shutdown();

    // Assert: both the logs and traces payloads carry the resource attributes
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mock.calls.forEach((args) => {
      const attributes = resourceAttributesFromBody(args[1]?.body);
      expect(attributes['service.name']).toBe('my-service');
      expect(attributes['service.version']).toBe('1.2.3');
    });
  });

  it('should add console processors and export via OTLP when logLevel is DEBUG', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'http://otlp-signal-endpoint:4318',
      exportHeaders: { 'x-test-header': 'test-value' },
      logLevel: 'DEBUG',
    });
    // Console exporters use SimpleProcessors, which export synchronously
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await browserSdk.shutdown();

    // Assert: the console exporters write to `console.dir`
    expect(consoleDirSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const logsCall = fetchSpy.mock.calls.find(
      (args) => args[0] === 'http://otlp-signal-endpoint:4318/v1/logs',
    );
    expect(logsCall).toBeDefined();
    expect(logsCall?.[1]).containSubset({
      headers: {
        'x-test-header': 'test-value',
      },
    });

    const tracesCall = fetchSpy.mock.calls.find(
      (args) => args[0] === 'http://otlp-signal-endpoint:4318/v1/traces',
    );
    expect(tracesCall).toBeDefined();
    expect(tracesCall?.[1]).containSubset({
      headers: {
        'x-test-header': 'test-value',
      },
    });
  });

  it('should add console processors for log levels above DEBUG', async () => {
    // Act: `VERBOSE` is louder than `DEBUG`, so it must not print less
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'http://otlp-signal-endpoint:4318',
      logLevel: 'VERBOSE',
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await browserSdk.shutdown();

    // Assert
    expect(consoleDirSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should not fall back to the default endpoint for an empty export URL', async () => {
    // Act: `exportUrl` is required, so an empty value is an unset variable
    browserSdk = quickStartBrowserSdk({ exportUrl: '' });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await browserSdk.shutdown();

    // Assert
    expect(browserSdk.invalidConfig).toStrictEqual(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('quickStartBrowserSdk forwards enabled and instrumentations', () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'http://otlp-signal-endpoint:4318',
      enabled: false,
      instrumentations: [instrumentation],
    });

    // Assert
    expect(instrumentation.enable).not.toHaveBeenCalled();

    // Act
    browserSdk.enable();

    // Assert
    expect(instrumentation.enable).toHaveBeenCalledOnce();
  });

  it('should emit only one error for an invalid URL in DEBUG mode', async () => {
    diagErrorSpy.mockClear();

    browserSdk = quickStartBrowserSdk({
      exportUrl: 'not_a_valid_url',
      logLevel: 'DEBUG',
    });

    expect(browserSdk.invalidConfig).toBe(true);
    expect(diagErrorSpy).toHaveBeenCalledTimes(1);
    expect(diagErrorSpy.mock.calls[0]?.[0]).toMatch(
      /Invalid OTLP export URL "not_a_valid_url"/,
    );
  });
});
