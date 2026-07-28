/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
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

    // Assert
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
    expect(diagErrorSpy).toHaveBeenCalled();
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(/Browser SDK won't start/);
    expect(fetchSpy).not.toHaveBeenCalled();
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
    logs.disable();
    trace.disable();
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
});
