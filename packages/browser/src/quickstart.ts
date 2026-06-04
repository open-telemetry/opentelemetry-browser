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
} from '@opentelemetry/sdk-trace-base';
import { startBrowserSdk } from './sdk.ts';

interface QuickStartConfig {
  logLevel: keyof typeof DiagLogLevel;
  serviceName: string;
  serviceVersion?: string;
  exportUrl: string;
  exportHeaders?: Record<string, string>;
}

export function quickStartBrowserSdk(config: QuickStartConfig) {
  const sdkConfig: Parameters<typeof startBrowserSdk>[0] = {
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
        new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
      ],
    };
    sdkConfig.traces = {
      processors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    };
  }

  return startBrowserSdk();
}
