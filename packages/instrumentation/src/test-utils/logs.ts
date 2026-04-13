/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

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
