/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, diag, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
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

function createFakeInstrumentation(): Instrumentation {
  return {
    instrumentationName: 'test-instrumentation',
    instrumentationVersion: '1.0.0',
    enable: vi.fn(),
    disable: vi.fn(),
    setTracerProvider: vi.fn(),
    setMeterProvider: vi.fn(),
    setLoggerProvider: vi.fn(),
    setConfig: vi.fn(),
    getConfig: () => ({ enabled: false }),
  };
}

describe('startBrowserSdk', () => {
  const response = { ok: true, json: async () => ({ ok: true }) } as Response;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const diagErrorSpy = vi.spyOn(diag, 'error');
  const diagDebugSpy = vi.spyOn(diag, 'debug');
  let browserSdk: WebSdk;

  // NOTE: we mock the registration of the logger/tracer provider because
  // the APIs only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    fetchSpy.mockRestore();
  });
  afterEach(async () => {
    await browserSdk?.shutdown();
    fetchSpy.mockClear();
    logs.disable();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  it('should not start disabled by configuration', async () => {
    // Act
    browserSdk = startBrowserSdk({
      disabled: true,
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert: an intentional disable is not flagged as an invalid config
    expect(browserSdk.invalidConfig).toBeFalsy();
    expect(diagDebugSpy).toHaveBeenCalled();
    expect(diagDebugSpy.mock.lastCall?.[0]).toMatch(/Browser SDK disabled/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should not start if an invalid signal export URL is provided', async () => {
    // Act
    browserSdk = startBrowserSdk({
      logs: {
        exportConfig: {
          url: 'this_is_not_an_URL',
        },
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
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(
      /Invalid OTLP export URL "this_is_not_an_URL". Logs SDK won't start/,
    );
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

  it('should accept exporter configuration with headers and default endpoints', async () => {
    // Act: no URLs at all - the root headers must reach both signal
    // exporters while each signal keeps its own default endpoint.
    browserSdk = startBrowserSdk({
      batchProcessorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
      exportConfig: {
        headers: { bar: 'baz' },
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert
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

  it('should use a signal export URL exactly as configured', async () => {
    // The signal URL is the full export target and is used verbatim, so a
    // collector behind a proxy path keeps its prefix and query string - the
    // regression behind #493.
    browserSdk = startBrowserSdk({
      logs: {
        exportConfig: {
          url: 'http://otlp-path.example:8080/otlp-http/v1/logs?key=value',
        },
      },
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert: logs went to the configured URL untouched; traces, which has
    // no URL of its own, used its default endpoint.
    expect(browserSdk.invalidConfig).toBeFalsy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      fetchSpy.mock.calls.find(
        (args) =>
          args[0] ===
          'http://otlp-path.example:8080/otlp-http/v1/logs?key=value',
      ),
    ).toBeDefined();
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://localhost:4318/v1/traces',
      ),
    ).toBeDefined();
  });

  it('should send each signal to its own configured URL', async () => {
    // Logs and traces can target different collectors; each URL is used as
    // configured, without deriving or rewriting anything.
    browserSdk = startBrowserSdk({
      logs: {
        exportConfig: {
          url: 'http://logs-collector.example:8080/v1/logs',
        },
      },
      traces: {
        exportConfig: {
          url: 'http://traces-collector.example:8080/v1/traces',
        },
      },
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
        (args) => args[0] === 'http://logs-collector.example:8080/v1/logs',
      ),
    ).toBeDefined();
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://traces-collector.example:8080/v1/traces',
      ),
    ).toBeDefined();
  });

  it('should not fall back to the default endpoint for an empty signal export URL', async () => {
    // Act: an empty URL is a mistake, usually an unset env var, so it must
    // fail loudly instead of silently exporting to the local collector.
    browserSdk = startBrowserSdk({
      logs: {
        exportConfig: {
          url: '',
        },
      },
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert
    expect(browserSdk.invalidConfig).toStrictEqual(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should register instrumentations on start and disable them on shutdown', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = startBrowserSdk({
      instrumentations: [instrumentation],
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
    });

    // Assert: providers are set and the instrumentation is enabled
    expect(instrumentation.enable).toHaveBeenCalled();
    expect(instrumentation.setTracerProvider).toHaveBeenCalled();
    expect(instrumentation.setMeterProvider).toHaveBeenCalled();
    expect(instrumentation.setLoggerProvider).toHaveBeenCalled();

    // Act
    await browserSdk.shutdown();
    // Prevent the afterEach hook from shutting down the same SDK again
    browserSdk = { shutdown: () => Promise.resolve() };

    // Assert: shutting down the SDK disables the instrumentations
    expect(instrumentation.disable).toHaveBeenCalled();
  });

  it('should not register instrumentations when disabled by configuration', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = startBrowserSdk({
      disabled: true,
      instrumentations: [instrumentation],
    });
    await browserSdk.shutdown();

    // Assert
    expect(instrumentation.enable).not.toHaveBeenCalled();
    expect(instrumentation.disable).not.toHaveBeenCalled();
  });

  it('should not register instrumentations when an invalid URL is provided', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = startBrowserSdk({
      logs: {
        exportConfig: {
          url: 'this_is_not_an_URL',
        },
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
  let diagDebugSpy: MockInstance;
  let diagErrorSpy: MockInstance;
  let browserSdk: WebSdk;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    consoleDirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});
    diagDebugSpy = vi.spyOn(diag, 'debug');
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
    diagDebugSpy.mockRestore();
    diagErrorSpy.mockRestore();
    logs.disable();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  it('should not start when disabled by configuration', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
      disabled: true,
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    // A started SDK would flush and export here; a disabled one must not
    await browserSdk.shutdown();

    // Assert
    expect(diagDebugSpy).toHaveBeenCalled();
    expect(diagDebugSpy.mock.lastCall?.[0]).toMatch(/Browser SDK disabled/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should forward the export URL and headers to the exporters', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
      logsExportUrl: 'http://otlp-signal-endpoint:4318/v1/logs',
      tracesExportUrl: 'http://otlp-signal-endpoint:4318/v1/traces',
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

  it('should use the quick start export URLs exactly as configured', async () => {
    // Each signal gets its own full URL, used verbatim: a collector behind
    // a proxy path keeps its prefix.
    browserSdk = quickStartBrowserSdk({
      logsExportUrl: 'http://otlp-path.example:8080/otlp-http/v1/logs',
      tracesExportUrl: 'http://otlp-path.example:8080/otlp-http/v1/traces',
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
        (args) => args[0] === 'http://otlp-path.example:8080/otlp-http/v1/logs',
      ),
    ).toBeDefined();
    expect(
      fetchSpy.mock.calls.find(
        (args) =>
          args[0] === 'http://otlp-path.example:8080/otlp-http/v1/traces',
      ),
    ).toBeDefined();
  });

  it('should default each signal to its own endpoint when no export URLs are given', async () => {
    // Act: no URLs configured - each signal exports to its own default
    // endpoint and the shared headers reach both exporters.
    browserSdk = quickStartBrowserSdk({
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
        (args) => args[0] === 'http://localhost:4318/v1/logs',
      ),
    ).toBeDefined();
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://localhost:4318/v1/traces',
      ),
    ).toBeDefined();
    fetchSpy.mock.calls.forEach((args) => {
      expect(args[1]).containSubset({
        method: 'POST',
        headers: { bar: 'baz' },
      });
    });
  });

  it('should propagate service name and version as resource attributes', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
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
      logsExportUrl: 'http://otlp-signal-endpoint:4318/v1/logs',
      tracesExportUrl: 'http://otlp-signal-endpoint:4318/v1/traces',
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
    // Act: an empty export URL is an unset variable, not a valid target
    browserSdk = quickStartBrowserSdk({ logsExportUrl: '' });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await browserSdk.shutdown();

    // Assert
    expect(browserSdk.invalidConfig).toStrictEqual(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should forward instrumentations to the SDK', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = quickStartBrowserSdk({
      instrumentations: [instrumentation],
    });

    // Assert: the SDK registers and enables the instrumentation
    expect(instrumentation.enable).toHaveBeenCalled();
    expect(instrumentation.setTracerProvider).toHaveBeenCalled();

    // Act
    await browserSdk.shutdown();

    // Assert: shutting down the SDK disables the instrumentation
    expect(instrumentation.disable).toHaveBeenCalled();
  });

  it('should not validate or emit URL errors when disabled even in DEBUG mode', async () => {
    diagErrorSpy.mockClear();

    browserSdk = quickStartBrowserSdk({
      disabled: true,
      logsExportUrl: 'not_a_valid_url',
      logLevel: 'DEBUG',
    });

    expect(browserSdk.invalidConfig).toBeFalsy();
    expect(diagErrorSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should emit only one error for an invalid URL in DEBUG mode', async () => {
    diagErrorSpy.mockClear();

    browserSdk = quickStartBrowserSdk({
      logsExportUrl: 'not_a_valid_url',
      logLevel: 'DEBUG',
    });

    expect(browserSdk.invalidConfig).toBe(true);
    expect(diagErrorSpy).toHaveBeenCalledTimes(1);
    expect(diagErrorSpy.mock.calls[0]?.[0]).toMatch(
      /Invalid OTLP export URL "not_a_valid_url"/,
    );
  });
});
