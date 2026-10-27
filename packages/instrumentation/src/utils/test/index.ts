/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger } from '@opentelemetry/api';
import { DiagLogLevel, diag, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { onTestFinished, vi } from 'vitest';
import type {
  Instrumentation,
  InstrumentationDeps,
} from '#instrumentation-base';

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
      new SimpleLogRecordProcessor({ exporter: memoryExporter }),
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
  const tracerProvider = new TracerProvider({
    spanProcessors: [
      ...spanProcessors,
      new SimpleSpanProcessor({ exporter: memoryExporter }),
    ],
  });
  trace.setGlobalTracerProvider(tracerProvider);
  return memoryExporter;
};

/**
 * Registers a mock diag logger for the current test and returns it. Component
 * loggers call it as `warn(namespace, message, ...args)`.
 */
export const setupTestDiagLogger = () => {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  } satisfies DiagLogger;
  diag.setLogger(logger, {
    logLevel: DiagLogLevel.ALL,
    suppressOverrideMessage: true,
  });
  onTestFinished(() => diag.disable());
  return logger;
};

/**
 * Enables `instrumentation` with `deps` (the globals by default) and disables
 * it when the test finishes.
 */
export const enableForTest = (
  instrumentation: Instrumentation,
  deps?: InstrumentationDeps,
) => {
  instrumentation.enable(deps);
  onTestFinished(() => instrumentation.disable());
};

/** Counts `_wrap` layers on `fn` by walking its `__original` chain. */
export const getWrapDepth = (fn: unknown): number => {
  let depth = 0;
  let current = fn as { __original?: unknown } | undefined;
  while (current && typeof current.__original === 'function') {
    depth += 1;
    current = current.__original as { __original?: unknown };
  }
  return depth;
};
