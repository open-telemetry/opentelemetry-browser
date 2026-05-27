/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TracerProvider } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
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
  const getTracerProviderSpy = vi
    .spyOn(trace, 'getTracerProvider')
    .mockImplementation(() => tracerProvider);
  let tracerProvider: TracerProvider;
  let tracesSdk: WebSdk;

  // NOTE: we mock the registration of the tracer provider because
  // the trace API only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    setGlobalTracerProviderSpy.mockRestore();
    getTracerProviderSpy.mockRestore();
    fetchSpy.mockRestore();
  });
  beforeEach(async () => {
    setGlobalTracerProviderSpy.mockClear();
    getTracerProviderSpy.mockClear();
    fetchSpy.mockClear();
    await tracesSdk?.shutdown();
  });

  it('should register a TracerProvider with a BatchSpanProcessor', async () => {
    // Act
    tracesSdk = startTracesSdk();

    // Assert
    expect(setGlobalTracerProviderSpy).callCount(1);
    // biome-ignore lint/suspicious/noExplicitAny: accessing private props
    const processors = (trace.getTracerProvider() as any)[
      '_activeSpanProcessor'
    ]['_spanProcessors'];
    expect(processors.length).toBe(1);
    expect(processors[0]).toBeInstanceOf(BatchSpanProcessor);
  });

  it('should use the default configuration for exporters', async () => {
    // Act
    tracesSdk = startTracesSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BSP_SCHEDULE_DELAY,
      },
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
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BSP_SCHEDULE_DELAY,
      },
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318/v1/traces',
        headers: { bar: 'baz' },
      },
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

  it('should append the resource attributes in exports', async () => {
    // Act
    tracesSdk = startTracesSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BSP_SCHEDULE_DELAY,
      },
      resourceAttributes: {
        'resource.attr1': 'value 1',
        'resource.attr2': 'value 2',
      },
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(setGlobalTracerProviderSpy).callCount(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://localhost:4318/v1/traces',
    );
    const fetchInit = fetchSpy.mock.lastCall?.[1];
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(fetchInit?.body as Uint8Array));
    const exportAttributes = payload.resourceSpans[0].resource.attributes;

    expect(exportAttributes).containSubset([
      { key: 'resource.attr1', value: { stringValue: 'value 1' } },
      { key: 'resource.attr2', value: { stringValue: 'value 2' } },
      { key: 'service.name', value: { stringValue: 'unknown_service' } },
      { key: 'telemetry.sdk.language', value: { stringValue: 'webjs' } },
      { key: 'telemetry.sdk.name', value: { stringValue: 'opentelemetry' } },
    ]);
  });

  it('should give precedence to serviceName & serviceVersion over resource attributes', async () => {
    // Act
    tracesSdk = startTracesSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BSP_SCHEDULE_DELAY,
      },
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      resourceAttributes: {
        'resource.attr1': 'value 1',
        'resource.attr2': 'value 2',
        'service.name': 'bad-name-service',
        'service.version': '0.0.1',
      },
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(setGlobalTracerProviderSpy).callCount(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://localhost:4318/v1/traces',
    );
    const fetchInit = fetchSpy.mock.lastCall?.[1];
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(fetchInit?.body as Uint8Array));
    const exportAttributes = payload.resourceSpans[0].resource.attributes;

    expect(exportAttributes).containSubset([
      { key: 'resource.attr1', value: { stringValue: 'value 1' } },
      { key: 'resource.attr2', value: { stringValue: 'value 2' } },
      { key: 'service.name', value: { stringValue: 'test-service' } },
      { key: 'service.version', value: { stringValue: '1.0.0' } },
      { key: 'telemetry.sdk.language', value: { stringValue: 'webjs' } },
      { key: 'telemetry.sdk.name', value: { stringValue: 'opentelemetry' } },
    ]);
  });

  it('should accept Span processors from the user', async () => {
    // Arrange
    let exportCalled = false;

    // Act
    tracesSdk = startTracesSdk({
      processors: [
        new SimpleSpanProcessor({
          export: () => (exportCalled = true),
          shutdown: () => Promise.resolve(),
        }),
      ],
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();

    // Assert
    expect(setGlobalTracerProviderSpy).callCount(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(exportCalled).toStrictEqual(true);
  });
});
