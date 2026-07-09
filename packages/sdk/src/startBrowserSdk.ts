/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogLevel } from '@opentelemetry/api';
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace';
import { combineSdks } from './core/sdk.ts';
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
   * Target URL for the SDK to send traces and logs.
   */
  exportUrl: string;
  /**
   * Headers to be added to each traces/logs export request.
   * This is the place to add API keys or similar.
   */
  exportHeaders?: Record<string, string>;
}

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
    // Explicit export configuration enables the Batch processors
    exportConfig: {
      url: config.exportUrl,
      headers: config.exportHeaders,
    },
  };

  // Add console processors if the user wants to debug
  if (config.logLevel === 'DEBUG') {
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

  return startBrowserSdk();
}
