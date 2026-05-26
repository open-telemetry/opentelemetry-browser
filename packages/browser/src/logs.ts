/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import { setSdkLogger } from './diag.ts';
import type { LogsConfig, WebSdk } from './types.ts';

const DEFAULT_LOGS_OTLP_ENDPOINT = 'http://localhost:4318/v1/logs';

/**
 * @param config The configuration for logs
 * @returns {WebSdk}
 */
export function startLogsSdk(config?: LogsConfig): WebSdk {
  // Set the logger
  setSdkLogger(config?.logLevel || 'INFO');

  const logsEndpoint = config?.exportConfig?.url || DEFAULT_LOGS_OTLP_ENDPOINT;
  const logsProcessor = new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: logsEndpoint,
      headers: config?.exportConfig?.headers,
    }),
    config?.processorConfig,
  );

  const resourceAttributes = config?.resourceAttributes ?? {};
  if (config?.serviceName) {
    resourceAttributes['service.name'] = config.serviceName;
  }
  if (config?.serviceVersion) {
    resourceAttributes['service.name'] = config.serviceVersion;
  }
  const resource = defaultResource().merge(
    resourceFromAttributes(resourceAttributes),
  );
  const loggerProvider = new LoggerProvider({
    resource,
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
