/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiagLogLevel } from '@opentelemetry/api';
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace';
import { combineSdks } from './core/sdk.ts';
import type { CommonConfig } from './core/types.ts';
import { startLogsSdk } from './logs/startLogsSdk.ts';
import { startTracesSdk } from './traces/startTracesSdk.ts';

/**
 * Combination of all singal SDKs into one. A shorthand for users to
 * start with all signals allowing them to pass some global configuration
 * options.
 */
export const startBrowserSdk = combineSdks({
  logs: startLogsSdk,
  traces: startTracesSdk,
});

export type QuickStartConfig = Pick<
  CommonConfig,
  'disabled' | 'serviceName' | 'serviceVersion' | 'instrumentations'
> & {
  /**
   * Log level for SDK's internal logger. `DEBUG` and above also print every
   * span and log record to the console.
   *
   * @defaultValue DiagLogLevel.INFO
   */
  logLevel?: keyof typeof DiagLogLevel;
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
};

/**
 * This function does the same as `startBrowserSdk` but requiring
 * a much simpler configuration object.
 */
export function quickStartBrowserSdk(config: QuickStartConfig) {
  const sdkConfig: Parameters<typeof startBrowserSdk>[0] = {
    disabled: config.disabled,
    logLevel: config.logLevel,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    instrumentations: config.instrumentations,
    // Explicit export configuration enables the Batch processors
    exportConfig: {
      url: config.exportUrl,
      headers: config.exportHeaders,
    },
  };

  // A threshold and not `=== 'DEBUG'`: `VERBOSE` and `ALL` are louder levels,
  // so they must not print less than `DEBUG` does
  const logLevel = config.logLevel && DiagLogLevel[config.logLevel];
  if (logLevel !== undefined && logLevel >= DiagLogLevel.DEBUG) {
    sdkConfig.logs = {
      processors: [
        new SimpleLogRecordProcessor({
          exporter: new ConsoleLogRecordExporter(),
        }),
      ],
    };
    sdkConfig.traces = {
      processors: [
        new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() }),
      ],
    };
  }

  return startBrowserSdk(sdkConfig);
}
