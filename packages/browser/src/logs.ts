/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';

import type { LogsConfig, WebSdk } from './types.ts';

const DEFAULT_LOGS_OTLP_ENDOINT = 'http://localhost:4318/v1/logs';

/**
 * @param config The configuration for logs
 * @returns {WebSdk}
 */
export function startLogsSdk(config?: LogsConfig): WebSdk {
  const logsEndpoint = config?.otlpLogsEndpoint || DEFAULT_LOGS_OTLP_ENDOINT;
  const logsProcessor = new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: logsEndpoint,
      headers: config?.otlpLogsHeaders,
    }),
    {
      scheduledDelayMillis: config?.blrpScheduleDelay,
      exportTimeoutMillis: config?.blrpExportTimeout,
      maxExportBatchSize: config?.blrpMaxExportBatchSize,
      maxQueueSize: config?.blrpMaxQueueSize,
    },
  );
  const loggerProvider = new LoggerProvider({
    resource: config?.resource,
    logRecordLimits: config?.logRecordLimits,
    processors: [logsProcessor],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  return {
    shutdown() {
      return loggerProvider.shutdown();
    },
  };
}
