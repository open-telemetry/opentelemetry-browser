/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogLevel } from '@opentelemetry/api';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace';
import { combineSdks } from './core/sdk.ts';
import type { ExportConfig } from './core/types.ts';
import { startLogsSdk } from './logs/startLogsSdk.ts';
import { startTracesSdk } from './traces/startTracesSdk.ts';

/**
 * Combination of all signal SDKs into one. A shorthand for users to
 * start with all signals allowing them to pass some global configuration
 * options.
 */
export const startBrowserSdk = combineSdks({
  logs: startLogsSdk,
  traces: startTracesSdk,
});

export interface QuickStartConfig {
  /**
   * Set `disabled: true` to disable the SDK
   *
   * @defaultValue undefined
   */
  disabled?: boolean;
  /**
   * Log level for SDK's internal logger
   *
   * @defaultValue DiagLogLevel.INFO
   */
  logLevel?: keyof typeof DiagLogLevel;
  /**
   * Sets the value of the `service.name` resource attribute
   */
  serviceName?: string;
  /**
   * Sets the value of the `service.version` resource attribute
   *
   * @defaultValue undefined
   */
  serviceVersion?: string;
  /**
   * Target URL for the SDK to send traces and logs. The signal path (`/v1/logs`,
   * `/v1/traces`) is set on it for each signal, replacing any path given here.
   */
  exportUrl: string;
  /**
   * Headers to be added to each traces/logs export request.
   * This is the place to add API keys or similar.
   */
  exportHeaders?: Record<string, string>;
  /**
   * List of instrumentations to be registered when the SDK starts
   */
  instrumentations?: Instrumentation[];
}

/**
 * This function does the same as `startBrowserSdk` but requiring
 * a much simpler configuration object.
 */
export function quickStartBrowserSdk(config: QuickStartConfig) {
  const exportConfig: ExportConfig = {
    url: config.exportUrl,
    headers: config.exportHeaders,
  };
  const sdkConfig: Parameters<typeof startBrowserSdk>[0] = {
    disabled: config.disabled,
    logLevel: config.logLevel,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    instrumentations: config.instrumentations,
    exportConfig,
  };

  // Setting `processors` stops the root `exportConfig` from propagating, so repeat
  // it here or DEBUG would drop the OTLP export. Each signal needs its own object
  // with no `url`: `combineSdks` writes the root URL plus the signal path into it.
  if (config.logLevel === 'DEBUG') {
    sdkConfig.logs = {
      processors: [
        new SimpleLogRecordProcessor({
          exporter: new ConsoleLogRecordExporter(),
        }),
      ],
      exportConfig: { ...exportConfig, url: undefined },
    };
    sdkConfig.traces = {
      processors: [
        new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() }),
      ],
      exportConfig: { ...exportConfig, url: undefined },
    };
  }

  return startBrowserSdk(sdkConfig);
}
