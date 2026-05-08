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
import type {
  GeneralLimits,
  Sampler,
  SpanLimits,
} from '@opentelemetry/sdk-trace-base';

/**
 * Export configuration. Can be used globally or per signal
 */
export interface ExportConfig {
  url?: string;
  headers?: Record<string, string>;
}

/**
 * Batch processor configuration. Can be used globally or per signal
 */
export interface ProcessorConfig {
  scheduledDelayMillis?: number;
  exportTimeoutMillis?: number;
  maxQueueSize?: number;
  maxExportBatchSize?: number;
}

export interface GlobalConfig {
  disabled?: boolean;
  logLevel?: DiagLogLevel;
  // Resource & Entities related
  serviceName?: string;
  resource?: Resource;
  // Export
  exportConfig?: ExportConfig;
  // add other globals for queue/batch size?

  // General Limits
  generalLimits: GeneralLimits;

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
  processorConfig?: ProcessorConfig;
  // Export
  exportConfig?: ExportConfig;
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
  processorConfig?: ProcessorConfig;
  // Export
  exportConfig?: ExportConfig;
  // Limits
  spanLimits?: SpanLimits;
}

export interface WebSdk {
  shutdown(): Promise<void>;
}
export type WebSdkFactory<T> = (config?: T) => WebSdk;
