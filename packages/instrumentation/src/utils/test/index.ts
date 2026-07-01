/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

/**
 * setupTestLogExporter is a utility function that sets up a test log exporter for use in testing.
 * It returns an instance of InMemoryLogRecordExporter, hooked into a SimpleLogRecordProcessor, and a LoggerProvider.
 * */
export const setupTestLogExporter = (
  logProcessors: LogRecordProcessor[] = [],
) => {
  const memoryExporter = new InMemoryLogRecordExporter();
  const logProvider = new LoggerProvider({
    processors: [
      ...logProcessors,
      new SimpleLogRecordProcessor(memoryExporter),
    ],
  });
  logs.setGlobalLoggerProvider(logProvider);
  return memoryExporter;
};

/**
 * setupTestSpanExporter is a utility function that sets up a test span exporter for use in testing.
 * It returns an instance of InMemorySpanExporter, hooked into a SimpleSpanProcessor, and a TracerProvider.
 * */
export const setupTestSpanExporter = (spanProcessors: SpanProcessor[] = []) => {
  const memoryExporter = new InMemorySpanExporter();
  const tracerProvider = new BasicTracerProvider({
    spanProcessors: [
      ...spanProcessors,
      new SimpleSpanProcessor(memoryExporter),
    ],
  });
  trace.setGlobalTracerProvider(tracerProvider);
  return memoryExporter;
};
