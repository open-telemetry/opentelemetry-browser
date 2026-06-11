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
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
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
  setSdkLogger(config?.logLevel);

  // Resolve resource
  const resourceAttributes = config?.resourceAttributes ?? {};
  if (config?.serviceName) {
    resourceAttributes['service.name'] = config.serviceName;
  }
  if (config?.serviceVersion) {
    resourceAttributes['service.version'] = config.serviceVersion;
  }
  const resource = defaultResource().merge(
    resourceFromAttributes(resourceAttributes),
  );

  // Resolve the list of log record processors.
  // - if provided by the user use them
  // - if not provided or exportConfig is set push a `BatchLogRecordProcessor`
  const processors: LogRecordProcessor[] = [];

  if (config?.processors) {
    processors.push(...config.processors);
  }
  if (!config?.processors || config?.exportConfig) {
    const logsEndpoint =
      config?.exportConfig?.url || DEFAULT_LOGS_OTLP_ENDPOINT;
    processors.push(
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: logsEndpoint,
          headers: config?.exportConfig?.headers,
        }),
        config?.batchProcessorConfig,
      ),
    );
  }

  const loggerProvider = new LoggerProvider({
    resource,
    logRecordLimits: config?.logRecordLimits,
    processors,
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  return {
    shutdown() {
      return loggerProvider.shutdown();
    },
  };
}
