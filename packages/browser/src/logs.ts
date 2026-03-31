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

import type { GlobalConfig, SignalSdk } from './types.ts';
import { getExportUrl } from './utils.ts';

export interface LogsSdkConfig {
  // Export
  otlpLogsEndpoint?: string;
  otlpLogsHeaders?: Record<string, string>;
  // Limits
  logRecordAttrLenghtLimit?: number;
  logRecordAttrCountLimit?: number;
}

export class LogsSdk implements SignalSdk<LogsSdkConfig> {
  private _loggerProvider: LoggerProvider | undefined;

  start(config: GlobalConfig & LogsSdkConfig) {
    const logsEndpoint = getExportUrl(
      config.otlpLogsEndpoint,
      config.otlpEndpoint,
      '/v1/logs',
    );

    const logsProcessor = new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: logsEndpoint,
        headers: config.otlpLogsHeaders ?? config.otlpHeaders,
      }),
    );
    this._loggerProvider = new LoggerProvider({
      // TODO: should resource bubble to SDK config???
      // resource: config.resource,
      processors: [logsProcessor],
    });
    logs.setGlobalLoggerProvider(this._loggerProvider);
  }
  shutdown() {
    if (this._loggerProvider) {
      return this._loggerProvider.shutdown();
    }
    return Promise.resolve();
  }
}
