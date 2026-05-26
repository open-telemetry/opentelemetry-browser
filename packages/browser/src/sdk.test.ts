/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TracerProvider } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import type { LoggerProvider } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startBrowserSdk } from './sdk.ts';
import type { WebSdk } from './types.ts';

// Arrange
const SCHEDULE_DELAY = 10;

describe('startBrowserSdk', () => {
  const response = { ok: true, json: async () => ({ ok: true }) } as Response;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const setGlobalLoggerProviderSpy = vi
    .spyOn(logs, 'setGlobalLoggerProvider')
    .mockImplementation((p) => {
      loggerProvider = p;
      return p;
    });
  const getLoggerProviderSpy = vi
    .spyOn(logs, 'getLoggerProvider')
    .mockImplementation(() => loggerProvider);
  const setGlobalTracerProviderSpy = vi
    .spyOn(trace, 'setGlobalTracerProvider')
    .mockImplementation((p) => {
      tracerProvider = p;
      return true;
    });
  const getTracerProviderSpy = vi
    .spyOn(trace, 'getTracerProvider')
    .mockImplementation(() => tracerProvider);
  let tracerProvider: TracerProvider;
  let loggerProvider: LoggerProvider;
  let browserSdk: WebSdk;

  // NOTE: we mock the registration of the logger/tracer provider because
  // the APIs only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    setGlobalLoggerProviderSpy.mockRestore();
    setGlobalTracerProviderSpy.mockRestore();
    getLoggerProviderSpy.mockRestore();
    getTracerProviderSpy.mockRestore();
    fetchSpy.mockRestore();
  });
  beforeEach(async () => {
    setGlobalLoggerProviderSpy.mockClear();
    setGlobalTracerProviderSpy.mockClear();
    getLoggerProviderSpy.mockClear();
    getTracerProviderSpy.mockClear();
    fetchSpy.mockClear();
    await browserSdk?.shutdown();
  });

  it('should register a LoggerProvider and TracerProvider', async () => {
    // Act
    browserSdk = startBrowserSdk();

    // Assert
    expect(setGlobalLoggerProviderSpy).callCount(1);
    const logProcessors = (logs.getLoggerProvider() as any)['_sharedState'][
      'processors'
    ];
    expect(logProcessors.length).toBe(1);
    expect(logProcessors[0]).toBeInstanceOf(BatchLogRecordProcessor);
    expect(setGlobalTracerProviderSpy).callCount(1);
    const spanProcessors = (trace.getTracerProvider() as any)[
      '_activeSpanProcessor'
    ]['_spanProcessors'];
    expect(spanProcessors.length).toBe(1);
    expect(spanProcessors[0]).toBeInstanceOf(BatchSpanProcessor);
  });

  it('should use the default configuration for batch processor', async () => {
    // Act
    browserSdk = startBrowserSdk({
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      processorConfig: {
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
      processorConfig: {
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
