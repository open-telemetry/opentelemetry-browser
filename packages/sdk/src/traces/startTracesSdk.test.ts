/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag, trace } from '@opentelemetry/api';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { WebSdk } from '../core/types.ts';
import { startTracesSdk } from './startTracesSdk.ts';

const BSP_SCHEDULE_DELAY = 10;

describe('startTracesSdk', () => {
  const response = { ok: true, json: async () => ({ ok: true }) } as Response;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const diagErrorSpy = vi.spyOn(diag, 'error');
  const diagDebugSpy = vi.spyOn(diag, 'debug');
  let tracesSdk: WebSdk;

  // NOTE: we mock the registration of the tracer provider because
  // the trace API only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    fetchSpy.mockRestore();
  });
  afterEach(async () => {
    fetchSpy.mockClear();
    await tracesSdk?.shutdown();
    trace.disable();
  });

  it('should not start if disabled by configuration', async () => {
    // Act
    tracesSdk = startTracesSdk({
      disabled: true,
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      batchProcessorConfig: {
        scheduledDelayMillis: BSP_SCHEDULE_DELAY,
      },
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(diagDebugSpy).toHaveBeenCalled();
    expect(diagDebugSpy.mock.lastCall?.[0]).toMatch(/Traces SDK disabled/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should not start if an invalid URL is provided', async () => {
    // Act
    tracesSdk = startTracesSdk({
      exportConfig: {
        url: 'this_is_not_an_URL',
      },
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      batchProcessorConfig: {
        scheduledDelayMillis: BSP_SCHEDULE_DELAY,
      },
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(diagErrorSpy).toHaveBeenCalled();
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(/Traces SDK won't start/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should not start for an invalid URL even when custom processors are set', async () => {
    // Arrange: an invalid `exportConfig.url` must not be silently skipped just
    // because the user also provided their own processors.
    let exportCalled = false;

    // Act
    tracesSdk = startTracesSdk({
      processors: [
        new SimpleSpanProcessor({
          exporter: {
            export: () => (exportCalled = true),
            shutdown: () => Promise.resolve(),
          },
        }),
      ],
      exportConfig: { url: 'this_is_not_an_URL' },
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(diagErrorSpy).toHaveBeenCalled();
    expect(diagErrorSpy.mock.lastCall?.[0]).toMatch(/Traces SDK won't start/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(exportCalled).toStrictEqual(false);
  });

  it('should use the default configuration for exporters', async () => {
    // Act
    tracesSdk = startTracesSdk({
      batchProcessorConfig: {
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
      batchProcessorConfig: {
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
      batchProcessorConfig: {
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
      batchProcessorConfig: {
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
          exporter: {
            export: () => (exportCalled = true),
            shutdown: () => Promise.resolve(),
          },
        }),
      ],
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();

    // Assert
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(exportCalled).toStrictEqual(true);
  });

  it('should add a BatchSpanProcessor into the list if exporter config is set', async () => {
    // Arrange
    let exportCalled = false;
    const url = 'http://otlp-signal-endpoint:4318/v1/traces';

    // Act
    tracesSdk = startTracesSdk({
      batchProcessorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BSP_SCHEDULE_DELAY,
      },
      exportConfig: { url },
      processors: [
        new SimpleSpanProcessor({
          exporter: {
            export: () => (exportCalled = true),
            shutdown: () => Promise.resolve(),
          },
        }),
      ],
    });
    trace.getTracer('traces-sdk-test').startSpan('test').end();
    await new Promise((r) => setTimeout(r, BSP_SCHEDULE_DELAY + 5));

    // Assert
    expect(exportCalled).toStrictEqual(true);
    expect(fetchSpy).toHaveBeenCalled();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(url);
  });
});
