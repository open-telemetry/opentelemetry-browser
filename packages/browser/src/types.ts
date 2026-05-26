/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Attributes,
  ContextManager,
  DiagLogLevel,
  TextMapPropagator,
} from '@opentelemetry/api';
import type {
  LogRecordLimits,
  LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type {
  GeneralLimits,
  Sampler,
  SpanLimits,
  SpanProcessor,
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
   * The resource attributes related to the telemetry being exported
   */
  resourceAttributes?: Attributes;
}

/**
 * Root configuration options when SDKs are combined into a single
 * one. This type is enhanced
 * by the `combineSdks` function by adding a key for each
 * signal used (logs, traces). Do not add a "logs" or "traces" key
 * here to avoid type collision.
 */
export type RootConfig = CommonConfig & {
  /**
   * Configuration for processors. If defined it will be applied to
   * `BatchSpanProcessor` and `BatchLogRecordProcessor` unless signal
   * specific configuration is set for the signal.
   */
  processorConfig?: ProcessorConfig;
  /**
   * Configuration for exporters. If defined it will be applied to the
   * exporters of the `BatchSpanProcessor` and `BatchLogRecordProcessor`
   * unless signal specific configuration is set for the signal.
   */
  exportConfig?: ExportConfig;
  // General Limits
  generalLimits?: GeneralLimits;
  // TODO: to be discussed in Browser SIG
  // Basic options that could translate to more complex ones
  // in specific signals like
  // 1. `sampleRate` becomes a TraceIdRatioBasedSampler for traces
  //    and maybe somethign else for other signals??? (sampling logs?)
  // sampleRate?: number;
};

export type LogsConfig = CommonConfig & {
  /**
   * Configuration for the LogRecord processor.
   */
  processorConfig?: ProcessorConfig;
  /**
   * Configuration for the LogRecord exporter.
   */
  exportConfig?: ExportConfig;
  /**
   * Limits for each LogRecord.
   */
  logRecordLimits?: LogRecordLimits;
  /**
   * List of LogRecordProcessor for the logger provider. Setting this will make the SDK
   * ignore `processorConfig` and `exportConfig` since no `BatchLogRecordProcessor` will
   * be created.
   */
  processors?: LogRecordProcessor[];
};

export type TracesConfig = CommonConfig & {
  // Context and Propagation
  contextManager?: ContextManager;
  propagators?: TextMapPropagator[];
  // Sampler
  sampler?: Sampler;
  /**
   * Configuration for the Span processor. Setting this
   * config will enable a `BatchSpanProcessor` whith an exporter
   * that has the default configuration or the one set in `exportConfig`
   * option.
   */
  processorConfig?: ProcessorConfig;
  /**
   * Configuration for the Span exporter. Setting this
   * config will enable a `BatchSpanProcessor` whith the default
   * options for batch and queue size and export schedule and timeouts
   * unless the `processorConfig` option is set.
   */
  exportConfig?: ExportConfig;
  /**
   * Limits for each Span.
   */
  spanLimits?: SpanLimits;
  /**
   * List of SpanProcessor for the tracer provider. Setting this will make the SDK
   * ignore `processorConfig` and `exportConfig` since no `BatchSpanProcessor` will
   * be created.
   */
  processors?: SpanProcessor[];
};

export interface WebSdk {
  shutdown(): Promise<void>;
}
export type WebSdkFactory<T> = (config?: T) => WebSdk;
