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
