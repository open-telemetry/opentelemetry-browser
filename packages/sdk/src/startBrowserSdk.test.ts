/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { WebSdk } from './core/types.ts';
import { startBrowserSdk } from './startBrowserSdk.ts';

// Arrange
const SCHEDULE_DELAY = 10;

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
