/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { WebSdk } from './core/types.ts';
import { startLogsSdk } from './logs/startLogsSdk.ts';
import { startBrowserSdk } from './startBrowserSdk.ts';
import { startTracesSdk } from './traces/startTracesSdk.ts';

const SCHEDULE_DELAY = 10;

interface IgnoreUrlsConfig {
  enabled?: boolean;
  ignoreUrls?: Array<string | RegExp>;
}

/**
 * Fake instrumentation with a mutable configuration. The network
 * instrumentations of this repo (fetch, xhr, resource-timing) all expose an
 * `ignoreUrls` configuration option; the SDK must merge its own export URLs
 * into that list without dropping what the user already configured.
 */
function createInstrumentationWithIgnoreUrls(
  config: IgnoreUrlsConfig = {},
): Instrumentation {
  return {
    instrumentationName: 'test-instrumentation',
    instrumentationVersion: '1.0.0',
    enable: vi.fn(),
    disable: vi.fn(),
    setTracerProvider: vi.fn(),
    setMeterProvider: vi.fn(),
    setLoggerProvider: vi.fn(),
    setConfig: vi.fn(),
    getConfig: () => config as never,
  } as Instrumentation;
}

/**
 * Reads the `ignoreUrls` list the instrumentation ended up with. The SDK
 * passes a fresh config object to `setConfig`, so this returns what the SDK
 * last set.
 */
function ignoreUrlsOf(
  instrumentation: Instrumentation,
): Array<string | RegExp> | undefined {
  const calls = (
    instrumentation.setConfig as unknown as {
      mock: { calls: unknown[][] };
    }
  ).mock?.calls;
  const last = calls?.[calls.length - 1]?.[0] as IgnoreUrlsConfig | undefined;
  return last?.ignoreUrls;
}

describe('export requests are not instrumented', () => {
  const response = {
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as Response;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const consoleDirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});
  let sdk: WebSdk;

  afterAll(() => {
    fetchSpy.mockRestore();
    consoleDirSpy.mockRestore();
  });

  afterEach(async () => {
    try {
      await sdk?.shutdown();
    } catch {
      /* already shutdown within the test */
    }
    fetchSpy.mockClear();
    logs.disable();
    trace.disable();
  });

  it('startBrowserSdk appends the resolved signal export URLs to ignoreUrls', () => {
    // Arrange
    const instrumentation = createInstrumentationWithIgnoreUrls({
      ignoreUrls: ['https://example.com/api'],
    });

    // Act: the root endpoint without a signal override resolves to the
    // signal paths below for the SDK-created exporters
    sdk = startBrowserSdk({
      exportConfig: { url: 'http://collector.example.com:4318' },
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert: both signal endpoints of the SDK-created exporters are merged
    // in after the user's own entry, which is preserved
    expect(ignoreUrlsOf(instrumentation)).toEqual([
      'https://example.com/api',
      'http://collector.example.com:4318/v1/logs',
      'http://collector.example.com:4318/v1/traces',
    ]);
  });

  it('startBrowserSdk uses the signal-specific export URLs when overridden', () => {
    // Arrange
    const instrumentation = createInstrumentationWithIgnoreUrls();

    // Act
    sdk = startBrowserSdk({
      logs: { exportConfig: { url: 'http://logs.example.com/v1/logs' } },
      traces: { exportConfig: { url: 'http://traces.example.com/v1/traces' } },
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert
    expect(ignoreUrlsOf(instrumentation)).toEqual([
      'http://logs.example.com/v1/logs',
      'http://traces.example.com/v1/traces',
    ]);
  });

  it('startBrowserSdk adds nothing when signals use custom processors only', () => {
    // Arrange: custom processors mean the SDK creates no OTLP exporter, so it
    // makes no requests of its own that could loop back into the telemetry
    const instrumentation = createInstrumentationWithIgnoreUrls({
      ignoreUrls: ['https://example.com/api'],
    });

    // Act
    sdk = startBrowserSdk({
      logs: {
        processors: [
          {
            onEmit: () => {},

            shutdown: async () => {},
            forceFlush: async () => {},
          },
        ],
      },
      traces: {
        processors: [
          {
            onStart: () => {},
            onEnd: () => {},
            shutdown: async () => {},
            forceFlush: async () => {},
          },
        ],
      },
      instrumentations: [instrumentation],
    });

    // Assert: the instrumentation's configuration was never touched
    expect(instrumentation.setConfig).not.toHaveBeenCalled();
  });

  it('startLogsSdk appends its own endpoint to ignoreUrls', () => {
    // Arrange
    const instrumentation = createInstrumentationWithIgnoreUrls();

    // Act
    sdk = startLogsSdk({
      exportConfig: { url: 'http://logs.example.com/v1/logs' },
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert
    expect(ignoreUrlsOf(instrumentation)).toEqual([
      'http://logs.example.com/v1/logs',
    ]);
  });

  it('startLogsSdk appends the default endpoint when none is configured', () => {
    // Arrange: no exportConfig at all is the plainest way to start the SDK;
    // it must start with the default endpoint and keep that endpoint out of
    // the instrumentations
    const instrumentation = createInstrumentationWithIgnoreUrls();

    // Act
    sdk = startLogsSdk({
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert
    expect(sdk.invalidConfig).toBeFalsy();
    expect(ignoreUrlsOf(instrumentation)).toEqual([
      'http://localhost:4318/v1/logs',
    ]);
  });

  it('startTracesSdk appends its own endpoint to ignoreUrls', () => {
    // Arrange
    const instrumentation = createInstrumentationWithIgnoreUrls();

    // Act
    sdk = startTracesSdk({
      exportConfig: { url: 'http://traces.example.com/v1/traces' },
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert
    expect(ignoreUrlsOf(instrumentation)).toEqual([
      'http://traces.example.com/v1/traces',
    ]);
  });

  it('startTracesSdk appends the default endpoint when none is configured', () => {
    // Arrange
    const instrumentation = createInstrumentationWithIgnoreUrls();

    // Act
    sdk = startTracesSdk({
      instrumentations: [instrumentation],
      batchProcessorConfig: { scheduledDelayMillis: SCHEDULE_DELAY },
    });

    // Assert
    expect(sdk.invalidConfig).toBeFalsy();
    expect(ignoreUrlsOf(instrumentation)).toEqual([
      'http://localhost:4318/v1/traces',
    ]);
  });

  it('signal SDKs add nothing when only custom processors are configured', () => {
    // Arrange
    const instrumentation = createInstrumentationWithIgnoreUrls({
      ignoreUrls: ['https://example.com/api'],
    });

    // Act
    sdk = startLogsSdk({
      processors: [
        {
          onEmit: () => {},
          shutdown: async () => {},
          forceFlush: async () => {},
        },
      ],
      instrumentations: [instrumentation],
    });

    // Assert: the instrumentation's configuration was never touched
    expect(instrumentation.setConfig).not.toHaveBeenCalled();
  });
});
