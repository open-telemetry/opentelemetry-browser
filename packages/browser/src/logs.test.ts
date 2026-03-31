/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LoggerProvider } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogsSdk } from './logs.ts';

const BLRP_SCHEDULE_DELAY = 10;

describe('LogsSdk', () => {
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
  let loggerProvider: LoggerProvider;
  let logsSdk: LogsSdk;

  // NOTE: we mock the registration of the logger provider because
  // the logs API only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    setGlobalLoggerProviderSpy.mockRestore();
    getLoggerProviderSpy.mockRestore();
    fetchSpy.mockRestore();
  });
  beforeEach(() => {
    setGlobalLoggerProviderSpy.mockClear();
    getLoggerProviderSpy.mockClear();
    fetchSpy.mockClear();
  });

  it('should register a LoggerProvider with a BatchLogRecordProcessor', async () => {
    // Act
    logsSdk = new LogsSdk();
    logsSdk.start();

    // Assert
    expect(setGlobalLoggerProviderSpy).callCount(1);
    // @ts-expect-error -- accessing private properties
    const processors = logs.getLoggerProvider()['_sharedState']['processors'];
    expect(processors.length).toBe(1);
    expect(processors[0]).toBeInstanceOf(BatchLogRecordProcessor);
  });

  it('should use the default configuration for exporters', async () => {
    // Act
    logsSdk = new LogsSdk();
    logsSdk.start({
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      blrpScheduleDelay: BLRP_SCHEDULE_DELAY,
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, BLRP_SCHEDULE_DELAY + 5));

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://localhost:4318/v1/logs',
    );
    expect(fetchSpy.mock.lastCall?.[1]).containSubset({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('should accept signal generic OTLP endpoint and headers', async () => {
    // Act
    logsSdk = new LogsSdk();
    logsSdk.start({
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      blrpScheduleDelay: BLRP_SCHEDULE_DELAY,
      otlpEndpoint: 'http://otlp-endpoint:4318',
      otlpHeaders: { foo: 'bar' },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, BLRP_SCHEDULE_DELAY + 5));

    // Assert
    expect(setGlobalLoggerProviderSpy).callCount(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://otlp-endpoint:4318/v1/logs',
    );
    expect(fetchSpy.mock.lastCall?.[1]).containSubset({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        foo: 'bar',
      },
    });
  });

  it('should accept signal specific OTLP endpoint and headers', async () => {
    // Act
    logsSdk = new LogsSdk();
    logsSdk.start({
      // NOTE: we set a short delay to speed up tests and avoid test timeouts
      blrpScheduleDelay: BLRP_SCHEDULE_DELAY,
      otlpLogsEndpoint: 'http://otlp-signal-endpoint:4318/v1/logs',
      otlpLogsHeaders: { bar: 'baz' },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, BLRP_SCHEDULE_DELAY + 5));

    // Assert
    expect(setGlobalLoggerProviderSpy).callCount(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://otlp-signal-endpoint:4318/v1/logs',
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
