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
  /**
   * URL to send the data. For signal specific exports you might need to
   * specify the singnal path like `/v1/traces`
   */
  url?: string;
  /**
   * Headers to be sent in each export request.
   */
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
 * The common configuration properties regardles of the SDK being
 * started. Any signal SDK should accept it and when SDKs are combined
 * these properties belong to the root configuration and not to
 * the sginal specific config.
 */
export interface CommonConfig {
  /**
   * Set `disabled: true` to disable the SDK
   */
  disabled?: boolean;
  /**
   * Log level for SDK's internal logger
   */
  logLevel?: keyof typeof DiagLogLevel;
  /**
   * Sets the value of the `service.name` resource attribute
   */
  serviceName?: string;
  /**
   * Sets the value of the `service.version` resource attribute
   */
  serviceVersion?: string;
  /**
   * The resource related to the telemetry being exported
   */
  resource?: Resource;
}

/**
 * Root configuration options when SDKs are combined into a single
 * one. This type is enhanced
 * by the `combineSdks` function by adding a key for each
 * signal used (logs, traces). Do not add a "logs" or "traces" key
 * here to avoid type collision.
 */
export type RootConfig = CommonConfig & {
  // Export
  exportConfig?: ExportConfig;
  // General Limits
  generalLimits?: GeneralLimits;
  // Basic options that could translate to more complex ones
  // in specific signals like
  // 1. `sampleRate` becomes a TraceIdRatioBasedSampler for traces
  //    and maybe somethign else for other signals??? (sampling logs?)
  // sampleRate?: number;
};

export type LogsConfig = CommonConfig & {
  // Processor
  processorConfig?: ProcessorConfig;
  // Export
  exportConfig?: ExportConfig;
  // Limits
  logRecordLimits?: LogRecordLimits;
};

export type TracesConfig = CommonConfig & {
  // Context and Propagation
  contextManager?: ContextManager;
  propagators?: TextMapPropagator[];
  // Sampler
  sampler?: Sampler;
  // Processor
  processorConfig?: ProcessorConfig;
  // Export
  exportConfig?: ExportConfig;
  // Limits
  spanLimits?: SpanLimits;
};

export interface WebSdk {
  shutdown(): Promise<void>;
}
export type WebSdkFactory<T> = (config?: T) => WebSdk;
