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

/**
 * The global configuration of the SDK. This type is enhanced
 * by the `combineSdks` function by adding a key for each
 * signal used (logs, traces). Do not add a "logs" or "traces" key
 * here to avoid type collision.
 */
export interface GlobalConfig {
  disabled?: boolean;
  logLevel?: keyof typeof DiagLogLevel;
  // Resource & Entities related
  serviceName?: string;
  serviceVersion?: string;
  resource?: Resource;
  // Export
  exportConfig?: ExportConfig;
  // General Limits
  generalLimits?: GeneralLimits;

  // Basic options that could translate to more complex ones
  // in specific signals like
  // 1. `sampleRate` becomes a TraceIdRatioBasedSampler for traces
  //    and maybe somethign else for other signals??? (sampling logs?)
  // sampleRate?: number;
}
export interface LogsConfig {
  logLevel?: keyof typeof DiagLogLevel;
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
  logLevel?: keyof typeof DiagLogLevel;
  // Context and Propagation
  contextManager?: ContextManager;
  propagators?: TextMapPropagator[];
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
