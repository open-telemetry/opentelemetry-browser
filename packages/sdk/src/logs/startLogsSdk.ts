/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { INVALID_CONFIG_SDK } from '../core/constants.ts';
import { setSdkLogger } from '../core/diag.ts';
import { parseExportUrl } from '../core/exportUrl.ts';
import type { LogsConfig, LogsSdk } from '../core/types.ts';

export const DEFAULT_LOGS_EXPORT_CONFIG: LogsConfig['exportConfig'] = {
  url: 'http://localhost:4318/v1/logs',
};

/**
 * @param config The configuration for logs
 * @returns {LogsSdk}
 */
export function startLogsSdk(config?: LogsConfig): LogsSdk {
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

  if (typeof config?.exportConfig?.url !== 'string') {
    if (processors.length) {
      diag.warn(
        'Export configuration URL is missing. Configured processors should handle LogRecord exports.',
      );
    } else {
      diag.warn(
        "Export configuration URL is missing. Logs SDK won't export any LogRecords.",
      );
    }
  } else {
    const logsEndpoint = config.exportConfig.url;

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

  // For any level equal or louder than `DEBUG` add console exporters
  // to get logs and traces print into the DevTools console.
  const logLevel = config?.logLevel && DiagLogLevel[config?.logLevel];
  if (logLevel !== undefined && logLevel >= DiagLogLevel.DEBUG) {
    processors.push(
      new SimpleLogRecordProcessor({
        exporter: new ConsoleLogRecordExporter(),
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
  if (config?.setGlobals !== false) {
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  return {
    loggerProvider,
    shutdown: () => loggerProvider.shutdown(),
  };
}
