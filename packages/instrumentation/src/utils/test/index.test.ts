/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { describe, expect, it } from 'vitest';
import { setupTestLogExporter, setupTestSpanExporter } from './index.ts';

describe('logTestUtils', () => {
  it('should collect logs in memory', () => {
    const memoryExporter = setupTestLogExporter();

    const logger = logs.getLogger('test-logger');
    logger.emit({
      body: 'Test log message',
    });

    const exportedLogs = memoryExporter.getFinishedLogRecords();
    expect(exportedLogs.length).toBe(1);
    expect(exportedLogs[0]?.body).toBe('Test log message');
  });
});

describe('traceTestUtils', () => {
  it('should collect spans in memory', () => {
    const memoryExporter = setupTestSpanExporter();

    const tracer = trace.getTracer('test-tracer');
    tracer.startSpan('test-span').end();

    const exportedSpans = memoryExporter.getFinishedSpans();
    expect(exportedSpans.length).toBe(1);
    expect(exportedSpans[0]?.name).toBe('test-span');
  });
});
