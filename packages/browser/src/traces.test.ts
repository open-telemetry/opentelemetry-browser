/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TracerProvider } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { startTracesSdk } from './traces.ts';
import type { WebSdk } from './types.ts';

const BSP_SCHEDULE_DELAY = 10;

describe('startTracesSdk', () => {
  const response = { ok: true, json: async () => ({ ok: true }) } as Response;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const setGlobalTracerProviderSpy = vi
    .spyOn(trace, 'setGlobalTracerProvider')
    .mockImplementation((p) => {
      tracerProvider = p;
      return true;
    });
  const getLoggerProviderSpy = vi
    .spyOn(trace, 'getTracerProvider')
    .mockImplementation(() => tracerProvider);
  let tracerProvider: TracerProvider;
  let tracesSdk: WebSdk;

  // NOTE: we mock the registration of the tracer provider because
  // the trace API only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    setGlobalTracerProviderSpy.mockRestore();
    getLoggerProviderSpy.mockRestore();
    fetchSpy.mockRestore();
  });
  beforeEach(async () => {
    setGlobalTracerProviderSpy.mockClear();
    getLoggerProviderSpy.mockClear();
    fetchSpy.mockClear();
    await tracesSdk?.shutdown();
  });

  it('should register a TracerProvider with a BatchSpanProcessor', async () => {
    // Act
    tracesSdk = startTracesSdk();

    // Assert
    expect(setGlobalTracerProviderSpy).callCount(1);
    const key = '_activeSpanProcessor';
    const subkey = '_spanProcessors';
    // @ts-expect-error -- accessing private properties
    const processors = trace.getTracerProvider()[key][subkey];
    expect(processors.length).toBe(1);
    expect(processors[0]).toBeInstanceOf(BatchSpanProcessor);
  });

  it('should use the default configuration for exporters', async () => {
    // Act
    tracesSdk = startTracesSdk({
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      bspScheduleDelay: BSP_SCHEDULE_DELAY,
    });

    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://localhost:4318/v1/traces',
    );
    expect(fetchSpy.mock.lastCall?.[1]).containSubset({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('should accept signal specific OTLP endpoint and headers', async () => {
    // Act
    tracesSdk = startTracesSdk({
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      bspScheduleDelay: BSP_SCHEDULE_DELAY,
      otlpTracesEndpoint: 'http://otlp-signal-endpoint:4318/v1/traces',
      otlpTracesHeaders: { bar: 'baz' },
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(setGlobalTracerProviderSpy).callCount(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://otlp-signal-endpoint:4318/v1/traces',
    );
    expect(fetchSpy.mock.lastCall?.[1]).containSubset({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        bar: 'baz',
      },
    });
  });
});
