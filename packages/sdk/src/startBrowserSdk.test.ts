/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, diag, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
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
  const diagWarnSpy = vi.spyOn(diag, 'warn');
  let consoleDirSpy: MockInstance | undefined;
  let browserSdk: WebSdk;

  afterAll(() => {
    fetchSpy.mockRestore();
  });
  // NOTE: the logs and trace APIs only accept one provider registration, so
  // they are disabled after each test to let the next one register its own
  afterEach(async () => {
    // `finally` so a failed shutdown still fails the test without leaking the
    // spy and the registered providers into the next one
    try {
      await browserSdk?.shutdown();
    } finally {
      fetchSpy.mockClear();
      diagWarnSpy.mockClear();
      consoleDirSpy?.mockRestore();
      consoleDirSpy = undefined;
      logs.disable();
      trace.disable();
      context.disable();
      propagation.disable();
    }
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

  it('should warn when a signal opts out of the root export config', async () => {
    // Arrange
    consoleDirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});

    // Act
    browserSdk = startBrowserSdk({
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318',
      },
      logs: {
        processors: [
          new SimpleLogRecordProcessor({
            exporter: new ConsoleLogRecordExporter(),
          }),
        ],
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert: logs opted out of OTLP, traces still export, and the user is told
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'http://otlp-signal-endpoint:4318/v1/traces',
    );
    expect(
      diagWarnSpy.mock.calls.find((args) =>
        /"logs" config sets `processors`/.test(args[0]),
      ),
    ).toBeDefined();
  });

  it('should warn when the export URL path is replaced by the signal path', async () => {
    // Act
    browserSdk = startBrowserSdk({
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318/otlp',
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert: the `/otlp` prefix is dropped, which is easy to miss without a warning
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://otlp-signal-endpoint:4318/v1/logs',
      ),
    ).toBeDefined();
    expect(
      diagWarnSpy.mock.calls.find((args) =>
        /path "\/otlp" is replaced/.test(args[0]),
      ),
    ).toBeDefined();
  });

  it('should propagate the root batch config to a signal that sets processors and exportConfig', async () => {
    // Arrange
    consoleDirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});

    // Act
    browserSdk = startBrowserSdk({
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318',
      },
      logs: {
        processors: [
          new SimpleLogRecordProcessor({
            exporter: new ConsoleLogRecordExporter(),
          }),
        ],
        exportConfig: {},
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert: exporting within the short delay proves the root schedule was
    // used. The 1000ms default for logs would not have flushed yet.
    expect(
      fetchSpy.mock.calls.find(
        (args) => args[0] === 'http://otlp-signal-endpoint:4318/v1/logs',
      ),
    ).toBeDefined();
  });

  it('should propagate the root export headers to a signal that sets its own exportConfig', async () => {
    // Act
    browserSdk = startBrowserSdk({
      batchProcessorConfig: {
        scheduledDelayMillis: SCHEDULE_DELAY,
      },
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318',
        headers: { 'x-api-key': 'secret' },
      },
      logs: {
        exportConfig: {},
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, SCHEDULE_DELAY + 5));

    // Assert: the root URL already propagated here, so dropping the headers
    // would send authenticated telemetry unauthenticated and get it rejected
    const logsCall = fetchSpy.mock.calls.find(
      (args) => args[0] === 'http://otlp-signal-endpoint:4318/v1/logs',
    );
    expect(logsCall).toBeDefined();
    expect(logsCall?.[1]).containSubset({
      headers: { 'x-api-key': 'secret' },
    });
  });

  it('should warn when a signal drops a root export set with headers only', async () => {
    // Act: no root `url`, so the default endpoint applies, but setting headers
    // is still the user configuring an export
    browserSdk = startBrowserSdk({
      exportConfig: {
        headers: { 'x-api-key': 'secret' },
      },
      logs: {
        processors: [
          new SimpleLogRecordProcessor({
            exporter: new ConsoleLogRecordExporter(),
          }),
        ],
      },
    });

    // Assert
    expect(
      diagWarnSpy.mock.calls.find((args) =>
        String(args[0]).includes('the root `exportConfig` is not propagated'),
      ),
    ).toBeDefined();
  });

  it('should not warn when no root export config was set at all', async () => {
    // Act
    browserSdk = startBrowserSdk({
      logs: {
        processors: [
          new SimpleLogRecordProcessor({
            exporter: new ConsoleLogRecordExporter(),
          }),
        ],
      },
    });

    // Assert: nothing was dropped, the default endpoint was never asked for
    expect(
      diagWarnSpy.mock.calls.find((args) =>
        String(args[0]).includes('the root `exportConfig` is not propagated'),
      ),
    ).toBeUndefined();
  });

  it('should report invalidConfig when a signal refuses to start', async () => {
    // Act: an empty `processors` array leaves the signal with no processor at all
    browserSdk = startBrowserSdk({
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318',
      },
      traces: {
        processors: [],
      },
    });

    // Assert: the signal logs its own reason, but the combined SDK is the only
    // thing the caller holds
    expect(browserSdk.invalidConfig).toStrictEqual(true);
  });

  it('should not warn about the SDK logger on a plain start', async () => {
    // Act
    browserSdk = startBrowserSdk({
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318',
      },
    });

    // Assert: each signal re-enters `setSdkLogger` internally, which must stay
    // quiet. A level the user never set is not something they can act on.
    expect(
      diagWarnSpy.mock.calls.find((args) =>
        String(args[0]).includes('Logger for SDKs already set'),
      ),
    ).toBeUndefined();
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
  let browserSdk: WebSdk;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    consoleDirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});
    diagDebugSpy = vi.spyOn(diag, 'debug');
  });
  afterEach(async () => {
    // Tests shut the SDK down themselves to flush their batch processors. A
    // second `shutdown()` replays the result of the first, so a rejection here
    // is a real failure and must fail the test. The `finally` keeps the next
    // test clean when that happens.
    try {
      await browserSdk?.shutdown();
    } finally {
      fetchSpy.mockRestore();
      consoleDirSpy.mockRestore();
      diagDebugSpy.mockRestore();
      logs.disable();
      trace.disable();
      context.disable();
      propagation.disable();
    }
  });

  it('should not start when disabled by configuration', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
      disabled: true,
      exportUrl: 'http://otlp-signal-endpoint:4318',
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

  it('should add console processors when logLevel is DEBUG', async () => {
    // Act
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'http://otlp-signal-endpoint:4318',
      logLevel: 'DEBUG',
    });
    // Console exporters use SimpleProcessors, which export synchronously
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();

    // Assert: the console exporters write to `console.dir`
    expect(consoleDirSpy).toHaveBeenCalled();
  });

  it('should not start for an invalid export URL in DEBUG', async () => {
    // Act: DEBUG is the only quick start path that sets `processors`, so it
    // reaches the signals differently and needs its own check
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'not_an_url',
      logLevel: 'DEBUG',
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await browserSdk.shutdown();

    // Assert: a console-only SDK would look alive while exporting nothing
    expect(browserSdk.invalidConfig).toStrictEqual(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleDirSpy).not.toHaveBeenCalled();
  });

  it('should forward instrumentations to the SDK', async () => {
    // Arrange
    const instrumentation = createFakeInstrumentation();

    // Act
    browserSdk = quickStartBrowserSdk({
      exportUrl: 'http://otlp-signal-endpoint:4318',
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
});
