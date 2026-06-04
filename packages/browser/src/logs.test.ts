/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { startLogsSdk } from './logs.ts';
import type { WebSdk } from './types.ts';

const BLRP_SCHEDULE_DELAY = 10;

describe('startLogsSdk', () => {
  const response = { ok: true, json: async () => ({ ok: true }) } as Response;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  let logsSdk: WebSdk;

  // NOTE: we mock the registration of the logger provider because
  // the logs API only allow to register once. With the mock we can use
  // a dedicated provider for the test
  afterAll(() => {
    fetchSpy.mockRestore();
  });
  afterEach(async () => {
    fetchSpy.mockClear();
    await logsSdk?.shutdown();
    logs.disable();
  });

  it('should use the default configuration for exporters', async () => {
    // Act
    logsSdk = startLogsSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BLRP_SCHEDULE_DELAY,
      },
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

  it('should accept signal specific OTLP endpoint and headers', async () => {
    // Act
    logsSdk = startLogsSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BLRP_SCHEDULE_DELAY,
      },
      exportConfig: {
        url: 'http://otlp-signal-endpoint:4318/v1/logs',
        headers: { bar: 'baz' },
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, BLRP_SCHEDULE_DELAY + 5));

    // Assert
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

  it('should append the resource attributes in exports', async () => {
    // Act
    logsSdk = startLogsSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BLRP_SCHEDULE_DELAY,
      },
      resourceAttributes: {
        'resource.attr1': 'value 1',
        'resource.attr2': 'value 2',
      },
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, BLRP_SCHEDULE_DELAY + 5));

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://localhost:4318/v1/logs',
    );
    const fetchInit = fetchSpy.mock.lastCall?.[1];
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(fetchInit?.body as Uint8Array));
    const exportAttributes = payload.resourceLogs[0].resource.attributes;

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
    logsSdk = startLogsSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BLRP_SCHEDULE_DELAY,
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
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, BLRP_SCHEDULE_DELAY + 5));

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(
      'http://localhost:4318/v1/logs',
    );
    const fetchInit = fetchSpy.mock.lastCall?.[1];
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(fetchInit?.body as Uint8Array));
    const exportAttributes = payload.resourceLogs[0].resource.attributes;

    expect(exportAttributes).containSubset([
      { key: 'resource.attr1', value: { stringValue: 'value 1' } },
      { key: 'resource.attr2', value: { stringValue: 'value 2' } },
      { key: 'service.name', value: { stringValue: 'test-service' } },
      { key: 'service.version', value: { stringValue: '1.0.0' } },
      { key: 'telemetry.sdk.language', value: { stringValue: 'webjs' } },
      { key: 'telemetry.sdk.name', value: { stringValue: 'opentelemetry' } },
    ]);
  });

  it('should accept LogRecord processors from the user', async () => {
    // Arrange
    let exportCalled = false;

    // Act
    logsSdk = startLogsSdk({
      processors: [
        new SimpleLogRecordProcessor({
          export: () => (exportCalled = true),
          shutdown: () => Promise.resolve(),
        }),
      ],
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });

    // Assert
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(exportCalled).toStrictEqual(true);
  });

  it('should add a BatchLogRecordProcessor into the list if exporter config is set', async () => {
    // Arrange
    let exportCalled = false;
    const url = 'http://otlp-signal-endpoint:4318/v1/traces';

    // Act
    logsSdk = startLogsSdk({
      processorConfig: {
        // NOTE: we set a short delay to speed up tests and avoid test timeouts
        scheduledDelayMillis: BLRP_SCHEDULE_DELAY,
      },
      exportConfig: { url },
      processors: [
        new SimpleLogRecordProcessor({
          export: () => (exportCalled = true),
          shutdown: () => Promise.resolve(),
        }),
      ],
    });
    logs.getLogger('logs-sdk-test').emit({ eventName: 'test' });
    await new Promise((r) => setTimeout(r, BLRP_SCHEDULE_DELAY + 5));

    // Assert
    expect(exportCalled).toStrictEqual(true);
    expect(fetchSpy).toHaveBeenCalled();
    expect(fetchSpy.mock.lastCall?.[0]).toEqual(url);
  });
});
