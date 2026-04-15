/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogLevel } from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';
import type { LogRecordLimits } from '@opentelemetry/sdk-logs';
import type { SpanLimits } from '@opentelemetry/sdk-trace-base';

export interface GlobalConfig {
  disabled?: boolean;
  logLevel?: DiagLogLevel;
  // Resource & Entities related
  serviceName?: string;
  resource?: Resource;
  // Export
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  // Limits
  attrLengthLimit?: number;
  attrCountLimit?: number;
}

export interface LogsConfig {
  // Resource & Entities related
  resource?: Resource;
  // Processor
  blrpScheduleDelay?: number;
  blrpExportTimeout?: number;
  blrpMaxQueueSize?: number;
  blrpMaxExportBatchSize?: number;
  // Export
  otlpLogsEndpoint?: string;
  otlpLogsHeaders?: Record<string, string>;
  // Limits
  logRecordLimits?: LogRecordLimits;
}

export interface TracesConfig {
  // Resource & Entities related
  resource?: Resource;
  // Processor
  bspScheduleDelay?: number;
  bspExportTimeout?: number;
  bspMaxQueueSize?: number;
  bspMaxExportBatchSize?: number;
  // Export
  otlpTracesEndpoint?: string;
  otlpTracesHeaders?: Record<string, string>;
  // Limits
  spanLimits?: SpanLimits;
}

export interface WebSdk {
  shutdown(): Promise<void>;
}
export type WebSdkFactory<T> = (config?: T) => WebSdk;
