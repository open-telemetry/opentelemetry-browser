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
  Sampler,
  SpanLimits,
  SpanProcessor,
} from '@opentelemetry/sdk-trace';
import type { GeneralLimits } from '@opentelemetry/sdk-trace-base';

/**
 * Export configuration. Can be used globally or per signal
 */
export interface ExportConfig {
  /**
   * URL to send the data. For signal specific exports you might need to
   * specify the signal path like `/v1/traces`. Default values depend on where
   * this config is defined:
   * - globally: the default is http://localhost:4318
   * - logs: the default is http://localhost:4318/v1/logs
   * - traces: the default is http://localhost:4318/v1/traces
   */
  url?: string;
  /**
   * Headers to be sent in each export request.
   *
   * @defaultValue undefined
   */
  headers?: Record<string, string>;
}

/**
 * Batch processor configuration. Can be used globally or per signal
 */
export interface BatchProcessorConfig {
  /**
   * Delay interval (in milliseconds) between two consecutive exports.
   * Default values depend on where this config is defined:
   * - logs: 1000
   * - traces: 5000
   */
  scheduledDelayMillis?: number;
  /**
   * Maximum allowed time (in milliseconds) to export data.
   *
   * @defaultValue 30000
   */
  exportTimeoutMillis?: number;
  /**
   * Maximum queue size.
   *
   * @defaultValue 2048
   */
  maxQueueSize?: number;
  /**
   * Maximum batch size.
   *
   * @defaultValue 512
   */
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
   *
   * @defaultValue "unknown_service"
   */
  serviceName?: string;
  /**
   * Sets the value of the `service.version` resource attribute
   *
   * @defaultValue undefined
   */
  serviceVersion?: string;
  /**
   * The resource attributes related to the telemetry being exported
   *
   * @defaultValue undefined
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
  batchProcessorConfig?: BatchProcessorConfig;
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
  batchProcessorConfig?: BatchProcessorConfig;
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
   * ignore `batchProcessorConfig` and `exportConfig` since no `BatchLogRecordProcessor` will
   * be created.
   */
  processors?: LogRecordProcessor[];
};

export type TracesConfig = CommonConfig & {
  // Context and Propagation
  /**
   * Manager use to carry context accross function boundaries
   *
   * @defaultValue undefined
   */
  contextManager?: ContextManager;
  /**
   * List of propagators to use when `propagation.inject` and `propagation.extract`
   * is called (by instrumentations or user code).
   *
   * @defaultValue undefined
   */
  propagators?: TextMapPropagator[];
  /**
   * Sampler to be used by tracer to decide if a Span os sampled or not.
   *
   * @defaultValue undefined
   */
  sampler?: Sampler;
  /**
   * Configuration for the Span processor. Setting this
   * config will enable a `BatchSpanProcessor` whith an exporter
   * that has the default configuration or the one set in `exportConfig`
   * option.
   */
  batchProcessorConfig?: BatchProcessorConfig;
  /**
   * Configuration for the Span exporter. Setting this
   * config will enable a `BatchSpanProcessor` whith the default
   * options for batch and queue size and export schedule and timeouts
   * unless the `batchProcessorConfig` option is set.
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
   *
   * @defaultValue undefined
   */
  processors?: SpanProcessor[];
};

export interface WebSdk {
  shutdown(): Promise<void>;
}
export type WebSdkFactory<T> = (config?: T) => WebSdk;
