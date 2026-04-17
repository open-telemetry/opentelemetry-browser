/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ContextManager,
  DiagLogLevel,
  TextMapPropagator,
} from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';
import type { LogRecordLimits } from '@opentelemetry/sdk-logs';
import type { Sampler, SpanLimits } from '@opentelemetry/sdk-trace-base';

export interface GlobalConfig {
  disabled?: boolean;
  logLevel?: DiagLogLevel;
  // Resource & Entities related
  serviceName?: string;
  resource?: Resource;
  // Export
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  // add other globals for queue/batch size

  // Global Limits
  attrLengthLimit?: number;
  attrCountLimit?: number;

  // Basic options that could translate to more complex ones
  // in specific signals like
  // 1. `sampleRate` becomes a TraceIdRatioBasedSampler for traces
  //    and maybe somethign else for other signals??? (sampling logs?)
  // sampleRate?: number;
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
  // Context and Propagation
  contextManager?: ContextManager;
  textMapPropagator?: TextMapPropagator;
  // Resource & Entities related
  resource?: Resource;
  // Sampler
  sampler?: Sampler;
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
