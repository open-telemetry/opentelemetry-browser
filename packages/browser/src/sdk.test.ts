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
  let webSdk: WebSdk;

  // NOTE: we mock the registration of the logger provider because
  // the logs API only allow to register once. With the mock we can use
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
    await webSdk?.shutdown();
  });

  it('should register a LoggerProvider and TracerProvider', async () => {
    // Act
    webSdk = startBrowserSdk();

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
});
