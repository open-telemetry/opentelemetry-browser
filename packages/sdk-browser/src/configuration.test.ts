/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import {
  InMemoryLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-web';
import { afterEach, describe, expect, it } from 'vitest';
import { configureBrowserSDK } from './configuration.ts';

describe('configureBrowserSDK', () => {
  afterEach(() => {
    trace.disable();
    logs.disable();
  });

  it('should set up tracer provider with span exporter', async () => {
    const spanExporter = new InMemorySpanExporter();

    const { shutdown } = configureBrowserSDK({
      serviceName: 'test-service',
      spanExporter,
    });

    const tracer = trace.getTracer('test');
    expect(tracer).toBeDefined();

    await shutdown();
  });

  it('should set up logger provider with log record exporter', async () => {
    const logRecordExporter = new InMemoryLogRecordExporter();

    const { shutdown } = configureBrowserSDK({
      serviceName: 'test-service',
      logRecordExporter,
    });

    const logger = logs.getLogger('test');
    expect(logger).toBeDefined();

    await shutdown();
  });

  it('should accept custom span processors', async () => {
    const spanExporter = new InMemorySpanExporter();
    const processor = new SimpleSpanProcessor(spanExporter);

    const { shutdown } = configureBrowserSDK({
      serviceName: 'test-service',
      spanProcessors: [processor],
    });

    const tracer = trace.getTracer('test');
    expect(tracer).toBeDefined();

    await shutdown();
  });

  it('should accept custom log record processors', async () => {
    const logRecordExporter = new InMemoryLogRecordExporter();
    const processor = new SimpleLogRecordProcessor(logRecordExporter);

    const { shutdown } = configureBrowserSDK({
      serviceName: 'test-service',
      logRecordProcessors: [processor],
    });

    const logger = logs.getLogger('test');
    expect(logger).toBeDefined();

    await shutdown();
  });

  it('should work with minimal config', async () => {
    const { shutdown } = configureBrowserSDK({});

    const tracer = trace.getTracer('test');
    expect(tracer).toBeDefined();

    const logger = logs.getLogger('test');
    expect(logger).toBeDefined();

    await shutdown();
  });

  it('should return a shutdown function', async () => {
    const { shutdown } = configureBrowserSDK({
      serviceName: 'test-service',
    });

    expect(typeof shutdown).toBe('function');
    await expect(shutdown()).resolves.toBeUndefined();
  });
});
