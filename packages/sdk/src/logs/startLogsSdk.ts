/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
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
import { setSdkLogger } from '../core/diag.ts';
import { parseExportUrl } from '../core/exportUrl.ts';
import type { LogsConfig, WebSdk } from '../core/types.ts';

const DEFAULT_LOGS_OTLP_ENDPOINT = 'http://localhost:4318/v1/logs';
// Returned when the signal is intentionally turned off via `config.disabled`.
const NOOP_SDK: WebSdk = { shutdown: () => Promise.resolve() };
// Returned when the signal refuses to start because of an invalid configuration
// (e.g. a bad export URL or no usable processors).
const INVALID_CONFIG_SDK: WebSdk = {
  invalidConfig: true,
  shutdown: () => Promise.resolve(),
};

/**
 * @param config The configuration for logs
 * @returns {WebSdk}
 */
export function startLogsSdk(config?: LogsConfig): WebSdk {
  // Set the logger
  setSdkLogger(config?.logLevel);

  if (config?.disabled) {
    diag.debug('Logs SDK disabled by configuration.');
    return NOOP_SDK;
  }

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

    // Bail out on an invalid URL instead of silently skipping the exporter,
    // which would leave the SDK running without exporting the telemetry.
    if (!parseExportUrl(logsEndpoint, 'Logs SDK')) {
      return INVALID_CONFIG_SDK;
    }
    processors.push(
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: logsEndpoint,
          headers: config?.exportConfig?.headers,
        }),
        ...config?.batchProcessorConfig,
      }),
    );
  }

  if (processors.length === 0) {
    diag.error("No LogRecord processors configured. Logs SDK won't start");
    return INVALID_CONFIG_SDK;
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
